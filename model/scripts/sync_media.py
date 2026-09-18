"""Verify pinned media offline, or restore it with --download (stdlib only)."""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import struct
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
IMAGE_ROOT = ROOT / "data/img"


def player_key(row):
    return int(row["season"]), row["team_id"], row["player_id"]


def verify_image(entry, blob):
    if hashlib.sha256(blob).hexdigest() != entry["sha256"]:
        raise ValueError(f"Media checksum mismatch: {entry['path']}")
    if entry["source"]["sha1"] and hashlib.sha1(blob).hexdigest() != entry["source"]["sha1"]:
        raise ValueError(f"Source revision mismatch: {entry['path']}")
    if not blob.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError(f"Not a PNG: {entry['path']}")
    if struct.unpack(">II", blob[16:24]) != (entry["width"], entry["height"]):
        raise ValueError(f"Image dimensions differ: {entry['path']}")


def verify_catalog(manifest):
    if manifest["schema_version"] != 1:
        raise ValueError("Unsupported media schema version")
    photos = {player_key(row) for row in manifest["players"]}
    missing = {player_key(row) for row in manifest["missing"]}
    if photos & missing:
        raise ValueError("A portrait is both available and missing")
    logos = {(row["season"], row["team_id"]) for row in manifest["teams"]}
    for entry in manifest["players"]:
        source = entry["source"]["metadata"]
        if source["tournament"] != f"LPL {entry['season']} {entry['source_split']}":
            raise ValueError(f"Portrait season/split mismatch: {entry['path']}")
        if source["team"].casefold().removesuffix(".cn") not in {entry["team"].casefold(), entry["team_short"].casefold()}:
            raise ValueError(f"Portrait team mismatch: {entry['path']}")
    for entry in manifest["teams"]:
        if entry["source"]["uploaded_at"] > entry["as_of"]:
            raise ValueError(f"Logo is newer than its historical cutoff: {entry['path']}")
    coverage = {}
    for dataset in ["test", "processed"]:
        with (ROOT / f"data/{dataset}/player_games.csv").open(newline="") as stream:
            rows = list(csv.DictReader(stream))
        people = {player_key(row) for row in rows}
        teams = {(int(row["season"]), row["team_id"]) for row in rows}
        if people - photos - missing or teams - logos:
            raise ValueError(f"Untracked media identities in {dataset}; update the manifest")
        coverage[dataset] = {"portraits": len(people & photos), "player_team_total": len(people),
                             "logos": len(teams & logos), "team_total": len(teams)}
        if dataset == "processed" and people != photos | missing:
            raise ValueError("Media manifest and processed player identities differ")
    return coverage


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download", action="store_true", help="Restore absent/corrupt files from pinned URLs")
    args = parser.parse_args()
    manifest = json.loads((IMAGE_ROOT / "manifest.json").read_text())
    coverage = verify_catalog(manifest)

    def check(entry):
        path = (IMAGE_ROOT / entry["path"]).resolve()
        if not path.is_relative_to(IMAGE_ROOT):
            raise ValueError("Image path escapes data/img")
        try:
            verify_image(entry, path.read_bytes())
            return
        except (FileNotFoundError, ValueError):
            if not args.download:
                raise
        request = Request(entry["source"]["image_url"], headers={"User-Agent": "STATS401-MediaSnapshot/1.0"})
        with urlopen(request, timeout=60) as response:
            blob = response.read()
        verify_image(entry, blob)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(blob)

    entries = manifest["players"] + manifest["teams"]
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(check, entries))
    print(json.dumps({"verified_files": len(entries), "coverage": coverage}, indent=2))


if __name__ == "__main__":
    main()
