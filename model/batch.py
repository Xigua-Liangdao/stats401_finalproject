"""Resume a checked league/year expansion from a verified annual source inventory."""
from __future__ import annotations
import argparse
from concurrent.futures import ProcessPoolExecutor, as_completed
from contextlib import redirect_stdout, redirect_stderr
import json
import hashlib
import os
from pathlib import Path
import traceback

# Limit native BLAS pools before importing pandas/scikit-learn in workers.
for key in ('OPENBLAS_NUM_THREADS', 'OMP_NUM_THREADS', 'MKL_NUM_THREADS', 'VECLIB_MAXIMUM_THREADS'):
    os.environ.setdefault(key, '1')

from acquire import file_hash
from dataset_registry import atomic_json, pipeline_hash, validate_bundle, write_registry
from source_bundles import prepare_sources

ROOT = Path(__file__).resolve().parents[1]


def build_one(record, root_string, fingerprint, force=False):
    root = Path(root_string)
    report_root = root / 'model/reports' / record['path']
    report_root.mkdir(parents=True, exist_ok=True)
    receipt = report_root / 'build.json'
    if file_hash(record['raw_path']) != record['source_sha256']:
        return dict(record, status='unavailable', model_status='unavailable',
                    reason='Raw snapshot changed after preparation; rebuild the source inventory before resuming.')
    if receipt.is_file() and not force:
        try:
            previous = json.loads(receipt.read_text())
            if (previous.get('pipeline_sha256') == fingerprint
                    and previous.get('source_sha256') == record['source_sha256']):
                validate_bundle(root, previous)
                version = hashlib.sha256((report_root/'manifest.json').read_bytes()).hexdigest()[:16]
                if previous.get('data_version') and previous['data_version'] != version:
                    raise ValueError('Receipt data version does not match its output manifest')
                previous['data_version'] = version
                atomic_json(receipt, previous)
                (report_root / 'failure.json').unlink(missing_ok=True)
                return dict(previous, cached=True)
        except (ValueError, OSError, KeyError, TypeError, StopIteration):
            pass
    log = report_root / 'build.log'
    try:
        with log.open('w') as stream, redirect_stdout(stream), redirect_stderr(stream):
            from run import run_dataset
            result = run_dataset(record['league'], record['year'], record['slug'],
                                 Path(record['raw_path']), make_plots=False, root=root)
            manifest_hash = hashlib.sha256((report_root / 'manifest.json').read_bytes()).hexdigest()[:16]
            merged = dict(record, **result, pipeline_sha256=fingerprint, data_version=manifest_hash)
            validate_bundle(root, merged)
        atomic_json(receipt, merged)
        (report_root / 'failure.json').unlink(missing_ok=True)
        return merged
    except Exception as error:
        with log.open('a') as stream:
            traceback.print_exc(file=stream)
        failed = dict(record, status='unavailable', model_status='unavailable',
                      reason=f'{type(error).__name__}: {error}', pipeline_sha256=fingerprint)
        atomic_json(report_root / 'failure.json', failed)
        return failed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inventory', type=Path, required=True)
    parser.add_argument('--cache', type=Path)
    parser.add_argument('--workers', type=int, default=4)
    parser.add_argument('--years', nargs='+', type=int)
    parser.add_argument('--leagues', nargs='+')
    parser.add_argument('--prepare-only', action='store_true')
    parser.add_argument('--prepared', type=Path, help='Reuse a prior discovered-bundles.json')
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()
    cache = args.cache or args.inventory.parent
    if args.prepared:
        prepared = json.loads(args.prepared.read_text())
        records, sources = prepared['datasets'], prepared['sources']
        if args.years:
            records = [r for r in records if r['year'] in args.years]
        if args.leagues:
            records = [r for r in records if r['league'] in args.leagues]
    else:
        inventory = json.loads(args.inventory.read_text())
        records, sources = prepare_sources(inventory, root=ROOT, cache=cache,
                                            years=args.years, leagues=args.leagues)
        atomic_json(cache / 'discovered-bundles.json', {'datasets': records, 'sources': sources})
    print(json.dumps({'event': 'discovered', 'datasets': len(records), 'sources': len(sources)}), flush=True)
    if args.prepare_only:
        return
    fingerprint = pipeline_hash(ROOT)
    # Keep already built combinations when resuming a selected subset.
    existing_path = ROOT / 'data/datasets.json'
    existing = json.loads(existing_path.read_text()).get('datasets', []) if existing_path.exists() else []
    results = {r['id']: r for r in existing}
    with ProcessPoolExecutor(max_workers=max(1, args.workers)) as pool:
        jobs = {pool.submit(build_one, record, str(ROOT), fingerprint, args.force): record for record in records}
        for completed, future in enumerate(as_completed(jobs), 1):
            try:
                record = future.result()
            except Exception as error:
                record = dict(jobs[future], status='unavailable', model_status='unavailable',
                              reason=f'{type(error).__name__}: {error}')
            results[record['id']] = record
            write_registry(ROOT, results.values(), sources)
            print(json.dumps({'event': 'built', 'completed': completed, 'total': len(records),
                              'id': record['id'], 'status': record['status'],
                              'games': record.get('games'), 'model_status': record.get('model_status'),
                              'cached': record.get('cached', False), 'reason': record.get('reason')},
                             ensure_ascii=False), flush=True)
    unavailable = [r for r in results.values() if r.get('status') != 'ready']
    print(json.dumps({'event': 'finished', 'ready': len(results)-len(unavailable),
                      'unavailable': len(unavailable)}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
