#!/usr/bin/env python3
"""Reproduce pinned Oracle's Elixir annual snapshots; requires Python 3.9+ and curl.

The checked-in manifest identifies official and mirror bytes separately. Downloads
never execute remote code, silently switch sources, or accept a changed checksum.
Use --discover-official to inspect live metadata without changing pinned sources.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import csv
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys

DEFAULT_MANIFEST = Path(__file__).resolve().parents[2] / 'data/source_inventory.json'
REQUIRED_COLUMNS = {'gameid', 'league', 'year', 'position', 'date'}


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def file_sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def cache_path(cache, name):
    if not name or Path(name).name != name or name in {'.', '..'}:
        raise ValueError(f'Unsafe cache filename: {name!r}')
    path = cache / name
    if path.is_symlink():
        raise ValueError(f'Cache files must not be symlinks: {path}')
    return path


def verify(path, expected_sha, expected_size):
    if not path.is_file():
        raise ValueError(f'Missing cached file: {path}')
    if path.stat().st_size != expected_size or file_sha256(path) != expected_sha:
        with path.open('rb') as stream:
            prefix = stream.read(8192).decode('utf-8', errors='replace').lower()
        hint = ('; server returned HTML (possibly a Drive quota/confirmation page)'
                if '<html' in prefix or '<!doctype html' in prefix else '')
        raise ValueError(f'Checksum/size mismatch: {path}{hint}. '
                         'No replacement source was accepted; inspect/remove the bad file before retrying.')


def curl_download(url, destination, resume=True):
    if not url.startswith('https://'):
        raise ValueError(f'Only HTTPS downloads are supported: {url}')
    command = ['curl', '--fail', '--location', '--silent', '--show-error',
               '--retry', '2', '--connect-timeout', '25', '--max-time', '900',
               '--proto', '=https', '--proto-redir', '=https']
    if resume and destination.exists():
        command.extend(['--continue-at', '-'])
    command.extend(['--output', str(destination), url])
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode:
        raise ValueError(f'Download failed: {url}: {result.stderr.strip()}. '
                         'Public Drive files can be quota-limited; no automatic fallback is used.')


def ensure_download(source, destination):
    if destination.exists():
        verify(destination, source['download_sha256'], source['download_size_bytes'])
        return
    partial = destination.with_name(destination.name + '.part')
    if not partial.exists() or partial.stat().st_size != source['download_size_bytes']:
        curl_download(source['download_url'], partial)
    verify(partial, source['download_sha256'], source['download_size_bytes'])
    partial.replace(destination)


def prepare_source(source, cache, verify_only=False):
    csv_path = cache_path(cache, source['cache_filename'])
    download_path = cache_path(cache, source['download_filename'])
    if csv_path.exists():
        verify(csv_path, source['sha256'], source['size_bytes'])
    elif verify_only:
        raise ValueError(f'Missing cached CSV: {csv_path}')
    else:
        ensure_download(source, download_path)
        if source.get('source_compression') == 'gzip':
            partial = csv_path.with_name(csv_path.name + '.unpacking')
            try:
                with gzip.open(download_path, 'rb') as compressed, partial.open('wb') as output:
                    shutil.copyfileobj(compressed, output, 1024 * 1024)
                verify(partial, source['sha256'], source['size_bytes'])
                partial.replace(csv_path)
            finally:
                partial.unlink(missing_ok=True)
        elif download_path != csv_path:
            raise ValueError('Uncompressed download_filename must equal cache_filename')
        verify(csv_path, source['sha256'], source['size_bytes'])
    if download_path != csv_path and download_path.exists():
        verify(download_path, source['download_sha256'], source['download_size_bytes'])
    with csv_path.open(encoding='utf-8-sig', newline='') as stream:
        header = next(csv.reader(stream), [])
    if REQUIRED_COLUMNS - set(header) or len(header) != source['column_count']:
        raise ValueError(f'Unexpected CSV schema: {csv_path}')
    record = dict(source, local_path=str(csv_path.resolve()), verified_at_utc=utc_now())
    if download_path.exists():
        record['download_local_path'] = str(download_path.resolve())
    print(f"VERIFIED {source['year']}: {source['rows']} rows, "
          f"{source['league_count']} leagues, {source['source_kind']}", flush=True)
    return record


def atomic_json(path, value):
    temporary = path.with_name(path.name + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)


def parse_official_listing(html):
    # Parse JSON embedded in a quoted JS string as data; never evaluate JavaScript.
    match = re.search(r"window\['_DRIVE_ivd'\] = '(.*?)';", html)
    if not match:
        raise ValueError('Public Drive folder metadata format changed; inspect it manually.')
    escaped = match.group(1).replace('\\x', '\\u00').replace('"', '\\"')
    entries = json.loads(json.loads('"' + escaped + '"'))[0]
    records = []
    for entry in entries:
        annual = re.fullmatch(r'(\d{4})_LoL_esports_match_data_from_OraclesElixir\.csv', entry[2])
        if annual:
            records.append({'year': int(annual[1]), 'filename': entry[2], 'file_id': entry[0],
                            'listed_size_bytes': entry[13],
                            'listed_modified_at_utc': datetime.fromtimestamp(
                                entry[10] / 1000, timezone.utc).isoformat(),
                            'url': 'https://drive.google.com/uc?export=download&id=' + entry[0]})
    if not records or len({r['year'] for r in records}) != len(records):
        raise ValueError('Official listing is empty or contains duplicate annual filenames.')
    return sorted(records, key=lambda record: record['year'])


def discover_official(manifest, cache):
    html_path = cache / 'official-folder.latest.html'
    curl_download(manifest['folder_url'], html_path, resume=False)
    records = parse_official_listing(html_path.read_text())
    target = cache / 'official_source_listing.latest.json'
    atomic_json(target, {'retrieved_at_utc': utc_now(), 'source_page': manifest['source_page'],
                        'folder_url': manifest['folder_url'], 'files': records})
    print(f'Live metadata written to {target}; pinned manifest was not changed.')


def run(manifest, cache, workers=3, verify_only=False):
    cache.mkdir(parents=True, exist_ok=True)
    sources = manifest['files']
    if len({s['year'] for s in sources}) != len(sources):
        raise ValueError('Duplicate annual source years in manifest')
    records, failures = [], []
    with ThreadPoolExecutor(max_workers=workers) as executor:
        pending = {executor.submit(prepare_source, s, cache, verify_only): s for s in sources}
        for future in as_completed(pending):
            try:
                records.append(future.result())
            except (OSError, ValueError, EOFError) as error:
                failures.append(f"{pending[future]['year']}: {error}")
    if failures:
        raise ValueError('\n'.join(failures) + '\nPrevious output inventory was left untouched.')
    output = dict(manifest, files=sorted(records, key=lambda s: s['year']), verified_at_utc=utc_now())
    if not verify_only:
        atomic_json(cache / 'source_inventory.json', output)
        print(f"Batch inventory: {cache / 'source_inventory.json'}")
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument('--cache', type=Path, required=True, help='External download/cache directory')
    parser.add_argument('--workers', type=int, default=3)
    parser.add_argument('--verify-only', action='store_true', help='No downloads or inventory writes')
    parser.add_argument('--discover-official', action='store_true', help='Inspect live Drive metadata only')
    args = parser.parse_args()
    if args.workers < 1:
        parser.error('--workers must be positive')
    if args.verify_only and args.discover_official:
        parser.error('--verify-only and --discover-official cannot be combined')
    try:
        manifest = json.loads(args.manifest.read_text())
        cache = args.cache.expanduser().resolve()
        if args.discover_official:
            cache.mkdir(parents=True, exist_ok=True)
            discover_official(manifest, cache)
        else:
            run(manifest, cache, args.workers, args.verify_only)
    except (OSError, ValueError, EOFError) as error:
        print(str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
