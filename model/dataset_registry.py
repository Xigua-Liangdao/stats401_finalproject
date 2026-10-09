"""Publish validated bundles and retain unavailable source coverage explicitly."""
from __future__ import annotations
import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

BUNDLE_FILES = ('dashboard.json', 'schema.json', 'team_panel.csv', 'players.csv', 'teams.csv',
                'lineups.csv', 'pairs.csv', 'timeline.csv', 'player_games.csv',
                'pair_games.csv', 'lineup_games.csv')


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.part')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    temporary.replace(path)


def pipeline_hash(root):
    names = ['prepare.py', 'baseline.py', 'aggregate.py', 'player_baseline.py',
             'lineup_affinity.py', 'export_data.py', 'build_test_data.py', 'run.py',
             'scripts/build_team_panel.py', 'dataset_paths.py', 'plots.py']
    digest = hashlib.sha256()
    for name in names:
        path = root / 'model' / name
        digest.update(name.encode() + b'\0' + path.read_bytes())
    return digest.hexdigest()


def validate_bundle(root, record):
    from acquire import file_hash
    relative = Path(record['path'])
    if relative.is_absolute() or '..' in relative.parts:
        raise ValueError('Invalid bundle path')
    manifest_path = root / 'model/reports' / relative / 'manifest.json'
    hashes = json.loads(manifest_path.read_text()) if manifest_path.is_file() else {}
    headers = {}
    for mode in ('processed', 'test'):
        folder = root / 'data' / mode / record['path']
        for name in BUNDLE_FILES:
            if not (folder / name).is_file():
                raise ValueError(f'Missing bundle file: {folder / name}')
            key = str((folder / name).relative_to(root))
            if key not in hashes or file_hash(folder / name) != hashes[key]:
                raise ValueError(f'Bundle checksum mismatch: {folder / name}')
            if name.endswith('.csv'):
                with (folder / name).open(newline='') as stream:
                    header = next(csv.reader(stream))
                if mode == 'processed':
                    headers[name] = header
                elif header != headers[name]:
                    raise ValueError(f'Test/processed columns differ: {name}')
        metadata = json.loads((folder / 'dashboard.json').read_text())['metadata']
        if int(metadata.get('season', -1)) != record['year']:
            raise ValueError(f'Wrong season in {folder}')
        if metadata.get('league') != record['league']:
            raise ValueError(f'Wrong league in {folder}')
    return True


def public_record(record):
    keys = ('id', 'league', 'year', 'path', 'status', 'games', 'raw_games', 'raw_rows',
            'date_start', 'date_end', 'model_status', 'reason', 'source_sha256', 'data_version')
    return {key: record[key] for key in keys if key in record}


def write_registry(root, records, sources=None):
    entries = sorted((public_record(row) for row in records),
                     key=lambda row: (row['league'].casefold(), -row['year']))
    ready = [row for row in entries if row.get('status') == 'ready']
    preferred = next((row for row in ready if row['league'] == 'LPL' and row['year'] == 2025), None)
    default = preferred or next(iter(sorted(ready, key=lambda row: -row['year'])), None)
    payload = {'version': 1, 'generated_at': datetime.now(timezone.utc).isoformat(),
               'default': {key: default[key] for key in ('league', 'year')} if default else None,
               'datasets': entries}
    if sources is not None:
        payload['sources'] = sources
    atomic_json(root / 'data/datasets.json', payload)
    return payload
