"""Preserve annual Oracle's Elixir CSVs as isolated league/year snapshots."""
from __future__ import annotations
import argparse
import gzip
import hashlib
import io
import json
import re
from datetime import datetime, timezone
from pathlib import Path
import pandas as pd
import requests
from dataset_paths import league_slug

ROOT = Path(__file__).resolve().parents[1]
COMMIT = 'ff34a9f935070b7a9c9610cff423eac1fd6deddc'
URL = ('https://raw.githubusercontent.com/cbplexiglass/LoL-Esports-Regional-Analyses/'
       f'{COMMIT}/2025_LoL_esports_match_data_from_OraclesElixir.csv')


def file_hash(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()



def write_snapshot(raw, annual_source, *, league, year, root=ROOT, legacy=False):
    slug = league_slug(league)
    folder = root / 'data/raw' if legacy else root / 'data/raw' / slug / str(year)
    folder.mkdir(parents=True, exist_ok=True)
    destination = folder / ('lpl_2025.csv.gz' if legacy else 'matches.csv.gz')
    source_path = folder / 'source.json'
    annual_hash = annual_source['sha256']
    if destination.is_file() and source_path.is_file():
        previous = json.loads(source_path.read_text())
        if (previous.get('annual_csv_sha256') == annual_hash
                and previous.get('league') == league and previous.get('year') == year
                and previous.get('raw_csv_gz_sha256') == file_hash(destination)):
            return previous
    partial = destination.with_suffix(destination.suffix + '.part')
    with partial.open('wb') as output:
        with gzip.GzipFile(filename='', fileobj=output, mode='wb', mtime=0) as compressed:
            compressed.write(raw.to_csv(index=False, lineterminator='\n').encode())
    partial.replace(destination)
    metadata = {
        'source_name': "Oracle's Elixir",
        'source_page': 'https://oracleselixir.com/tools/downloads',
        'download_url': annual_source.get('url') or annual_source.get('download_url'),
        'source_kind': annual_source.get('source_kind', 'annual_csv'),
        'source_revision': annual_source.get('revision'),
        'annual_sources': annual_source.get('annual_sources', []),
        'cross_source_exact_duplicates_removed': annual_source.get('duplicates_removed', 0),
        'retrieved_at_utc': annual_source.get('retrieved_at_utc', datetime.now(timezone.utc).isoformat()),
        'annual_csv_sha256': annual_hash, 'annual_rows': annual_source.get('rows'),
        'league': league, 'year': year,
        'filter': f'league == {league!r} and year == {str(year)!r}; all positions and columns preserved',
        'raw_rows': len(raw), 'raw_columns': len(raw.columns),
        'raw_games': int(raw.loc[raw.gameid.ne(''), 'gameid'].nunique()),
        'raw_csv_gz_sha256': file_hash(destination),
    }
    source_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
    return metadata


def split_annual(source, *, root=ROOT, leagues=None):
    path = Path(source['local_path'])
    checksum = file_hash(path)
    if source.get('sha256') and checksum != source['sha256']:
        raise ValueError(f'Annual checksum mismatch: {path}')
    annual = pd.read_csv(path, dtype=str, keep_default_na=False)
    missing = {'gameid', 'league', 'year', 'position'} - set(annual)
    if missing:
        raise ValueError(f'Not an Oracle\'s Elixir annual CSV: missing {sorted(missing)}')
    info = dict(source, sha256=checksum, rows=len(annual))
    records = []
    for (league, year_text), raw in annual.groupby(['league', 'year'], sort=True):
        if not league.strip() or not re.fullmatch(r'\d{4}', year_text):
            raise ValueError(f'Invalid source league/year: {league!r}/{year_text!r}')
        year = int(year_text)
        if leagues is not None and league not in leagues:
            continue
        meta = write_snapshot(raw, info, league=league, year=year, root=root)
        slug = league_slug(league)
        records.append({'id': f'{slug}-{year}', 'league': league, 'year': year,
                        'path': f'{slug}/{year}', 'slug': slug,
                        'raw_games': meta['raw_games'], 'raw_rows': meta['raw_rows'],
                        'raw_path': str(root / 'data/raw' / slug / str(year) / 'matches.csv.gz'),
                        'source_sha256': meta['raw_csv_gz_sha256']})
    if not records:
        raise ValueError(f'No selected league/year datasets in {path}')
    return records


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--annual', type=Path, help='Verified local annual CSV')
    parser.add_argument('--year', type=int, default=2025)
    parser.add_argument('--league', help='Exact source label; omit to split every league')
    parser.add_argument('--url', help='Provenance URL for --annual')
    args = parser.parse_args()
    if args.annual:
        records = split_annual({'year': args.year, 'local_path': str(args.annual),
                                'url': args.url, 'sha256': file_hash(args.annual)},
                               leagues={args.league} if args.league else None)
        print(json.dumps(records, ensure_ascii=False, indent=2))
        return
    if args.year != 2025 or (args.league and args.league != 'LPL'):
        parser.error('Other datasets require --annual with a verified CSV')
    response = requests.get(URL, timeout=(15, 180))
    response.raise_for_status()
    annual = pd.read_csv(io.BytesIO(response.content), dtype=str, keep_default_na=False)
    raw = annual[(annual.league == 'LPL') & (annual.year == '2025')]
    if raw.empty:
        raise ValueError('Source contains no 2025 LPL rows')
    meta = write_snapshot(raw, {'sha256': hashlib.sha256(response.content).hexdigest(),
                               'url': URL, 'revision': COMMIT, 'rows': len(annual)},
                          league='LPL', year=2025, legacy=True)
    print(f'Saved {meta["raw_rows"]:,} original LPL 2025 rows')


if __name__ == '__main__':
    main()
