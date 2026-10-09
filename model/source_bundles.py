"""Merge annual files by actual source league/year, preserving cross-file provenance."""
from __future__ import annotations
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path
import pandas as pd
from acquire import file_hash, league_slug, write_snapshot
from dataset_registry import atomic_json


def prepare_sources(inventory, *, root, cache, years=None, leagues=None):
    sources = inventory.get('files', inventory) if isinstance(inventory, dict) else inventory
    groups = defaultdict(list)
    public_sources = []
    for source in sources:
        path = Path(source['local_path'])
        sha = file_hash(path)
        if sha != source['sha256']:
            raise ValueError(f'Annual checksum mismatch: {path}')
        shard_root = cache / 'shards' / sha
        shard_index = shard_root / 'index.json'
        parts = None
        if shard_index.is_file():
            try:
                cached = json.loads(shard_index.read_text())
                if cached and all(part.get('sha256') == file_hash(part['path']) for part in cached):
                    parts = cached
            except (ValueError, OSError, KeyError, TypeError):
                pass
        if parts is None:
            print(json.dumps({'event': 'split_annual', 'year': source['year']}, ensure_ascii=False), flush=True)
            annual = pd.read_csv(path, dtype=str, keep_default_na=False)
            if {'gameid', 'league', 'year', 'position'} - set(annual):
                raise ValueError(f'Annual file lacks mandatory columns: {path}')
            parts = []
            for (league, year_text), raw in annual.groupby(['league', 'year'], sort=True):
                if not league.strip() or not re.fullmatch(r'\d{4}', year_text):
                    raise ValueError(f'Invalid league/year: {league!r}/{year_text!r}')
                slug, year = league_slug(league), int(year_text)
                shard = shard_root / f'{slug}-{year}.csv.gz'
                shard.parent.mkdir(parents=True, exist_ok=True)
                raw.to_csv(shard, index=False, compression={'method': 'gzip', 'mtime': 0})
                parts.append({'league': league, 'year': year, 'path': str(shard),
                              'rows': len(raw), 'sha256': file_hash(shard)})
            atomic_json(shard_index, parts)
            del annual
        public = {key: source[key] for key in ('year', 'url', 'sha256', 'revision', 'source_kind',
                    'retrieved_at_utc', 'size_bytes', 'listed_size_bytes', 'rows', 'snapshot_note',
                    'download_sha256', 'download_url', 'filename') if key in source}
        public_sources.append(public)
        for part in parts:
            if years and part['year'] not in years:
                continue
            if leagues and part['league'] not in leagues:
                continue
            groups[(part['league'], part['year'])].append((part, public))
    records = []
    for (league, year), parts in sorted(groups.items()):
        raw = pd.concat([pd.read_csv(part['path'], dtype=str, keep_default_na=False)
                         for part, _ in parts], ignore_index=True).fillna('')
        before = len(raw)
        raw = raw.drop_duplicates().reset_index(drop=True)
        origin = [dict(source, selected_rows=part['rows']) for part, source in parts]
        sha = (origin[0]['sha256'] if len(origin) == 1 else
               hashlib.sha256(json.dumps([s['sha256'] for s in origin]).encode()).hexdigest())
        info = {'sha256': sha, 'annual_sources': origin, 'duplicates_removed': before-len(raw),
                'rows': sum(s.get('rows', 0) for s in origin), 'url': origin[0].get('url'),
                'source_kind': origin[0].get('source_kind'), 'revision': origin[0].get('revision')}
        meta = write_snapshot(raw, info, league=league, year=year, root=root)
        slug = league_slug(league)
        records.append({'id': f'{slug}-{year}', 'league': league, 'year': year, 'slug': slug,
                        'path': f'{slug}/{year}', 'raw_games': meta['raw_games'],
                        'raw_rows': meta['raw_rows'], 'source_sha256': meta['raw_csv_gz_sha256'],
                        'raw_path': str(root/'data/raw'/slug/str(year)/'matches.csv.gz')})
    return records, public_sources
