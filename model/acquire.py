"""Recreate the source snapshot without changing any source column values."""
from __future__ import annotations

import gzip
import hashlib
import io
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
COMMIT = "ff34a9f935070b7a9c9610cff423eac1fd6deddc"
URL = ("https://raw.githubusercontent.com/cbplexiglass/LoL-Esports-Regional-Analyses/"
       f"{COMMIT}/2025_LoL_esports_match_data_from_OraclesElixir.csv")


def main():
    response = requests.get(URL, timeout=(15, 180))
    response.raise_for_status()
    if not response.content.startswith(b"gameid,"):
        raise ValueError("Expected the Oracle's Elixir CSV header.")
    annual = pd.read_csv(io.BytesIO(response.content), dtype=str, keep_default_na=False)
    raw = annual[(annual.league == "LPL") & (annual.year == "2025")]
    if raw.empty:
        raise ValueError("Source contains no 2025 LPL rows.")
    destination = ROOT / "data/raw/lpl_2025.csv.gz"
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as output:
        with gzip.GzipFile(filename="", fileobj=output, mode="wb", mtime=0) as compressed:
            compressed.write(raw.to_csv(index=False, lineterminator="\n").encode())
    metadata = {
        "source_name": "Oracle's Elixir",
        "source_page": "https://oracleselixir.com/tools/downloads",
        "download_url": URL,
        "mirror_commit": COMMIT,
        "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
        "annual_csv_sha256": hashlib.sha256(response.content).hexdigest(),
        "annual_rows": len(annual),
        "filter": "league == 'LPL' and year == '2025'; all positions and all original columns preserved",
        "raw_rows": len(raw), "raw_columns": len(raw.columns),
        "raw_csv_gz_sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
    }
    destination.with_name("source.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(f"Saved {len(raw):,} raw LPL rows with {len(raw.columns)} source columns.")


if __name__ == "__main__":
    main()
