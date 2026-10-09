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


def player_key(row, league=None):
    return league or row.get("league", "LPL"), int(row["season"]), row["team_id"], row["player_id"]


def verify_image(entry, blob):
    if hashlib.sha256(blob).hexdigest() != entry["sha256"]:
        raise ValueError(f"Media checksum mismatch: {entry['path']}")
    if entry["source"]["sha1"] and hashlib.sha1(blob).hexdigest() != entry["source"]["sha1"]:
        raise ValueError(f"Source revision mismatch: {entry['path']}")
    if not blob.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError(f"Not a PNG: {entry['path']}")
    if struct.unpack(">II", blob[16:24]) != (entry["width"], entry["height"]):
        raise ValueError(f"Image dimensions differ: {entry['path']}")


def verify_catalog(media):
    if media["schema_version"] != 1:
        raise ValueError("Unsupported media.json version")
    photos = {player_key(row) for row in media["players"]}
    missing = {player_key(row) for row in media["missing"]}
    if photos & missing:
        raise ValueError("A portrait is both available and missing")
    logos = {(row.get("league", "LPL"), row["season"], row["team_id"]) for row in media["teams"]}
    for entry in media["players"]:
        source = entry["source"]["metadata"]
        if source["tournament"] != f"{entry.get('league', 'LPL')} {entry['season']} {entry['source_split']}":
            raise ValueError(f"Portrait season/split mismatch: {entry['path']}")
        if source["team"].casefold().removesuffix(".cn") not in {entry["team"].casefold(), entry["team_short"].casefold()}:
            raise ValueError(f"Portrait team mismatch: {entry['path']}")
    for entry in media["teams"]:
        if entry["source"]["uploaded_at"] > entry["as_of"]:
            raise ValueError(f"Logo is newer than its historical cutoff: {entry['path']}")
    coverage = {}
    registry_path = ROOT / 'data/datasets.json'
    datasets = (json.loads(registry_path.read_text())['datasets'] if registry_path.exists()
                else [{'id': 'lpl-2025', 'league': 'LPL', 'path': '', 'status': 'ready'}])
    for entry in datasets:
        if entry['status'] != 'ready':
            continue
        for mode in ('test', 'processed'):
            directory = ROOT / 'data' / mode / entry['path']
            with (directory / 'players.csv').open(newline='') as stream:
                rows = list(csv.DictReader(stream))
            people = {player_key(row, entry['league']) for row in rows}
            teams = {(entry['league'], int(row['season']), row['team_id']) for row in rows}
            coverage[f"{mode}/{entry['id']}"] = {
                'portraits': len(people & photos), 'player_team_total': len(people),
                'portrait_fallbacks': len(people - photos),
                'logos': len(teams & logos), 'team_total': len(teams),
                'logo_fallbacks': len(teams - logos),
            }
    # Source bytes remain strictly verified. Missing identities in new datasets
    # are honest neutral placeholders, not a reason to borrow another jersey.
    return coverage


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download", action="store_true", help="Restore absent/corrupt files from pinned URLs")
    parser.add_argument("--coverage-output", type=Path, help="Write per-dataset coverage as JSON")
    args = parser.parse_args()
    media = json.loads((IMAGE_ROOT / "media.json").read_text())
    coverage = verify_catalog(media)

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

    entries = media["players"] + media["teams"]
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(check, entries))
    if args.coverage_output:
        args.coverage_output.parent.mkdir(parents=True, exist_ok=True)
        args.coverage_output.write_text(json.dumps(coverage, indent=2) + "\n")
        print(json.dumps({'verified_files': len(entries), 'dataset_modes_checked': len(coverage),
                          'coverage_file': str(args.coverage_output)}, indent=2))
    else:
        print(json.dumps({"verified_files": len(entries), "coverage": coverage}, indent=2))


if __name__ == "__main__":
    main()
