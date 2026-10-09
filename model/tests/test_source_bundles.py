"""Source inventory season boundaries, provenance, and path safety."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from acquire import file_hash, league_slug
from source_bundles import prepare_sources
from dataset_registry import BUNDLE_FILES, validate_bundle


class SourceBundleTests(unittest.TestCase):
    def source(self, root, file_year, rows):
        path = root / f'annual-{file_year}.csv'
        pd.DataFrame(rows).to_csv(path, index=False)
        return {'year': file_year, 'local_path': str(path), 'sha256': file_hash(path),
                'url': f'https://example.test/{file_year}.csv', 'rows': len(rows)}

    def test_source_season_controls_directory_and_overlaps_are_deduplicated(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            row = {'gameid': 'shared', 'league': 'EU LCS', 'year': '2015', 'position': 'top'}
            first = self.source(root, 2014, [row, dict(row, gameid='old', year='2014')])
            second = self.source(root, 2015, [row, dict(row, gameid='new')])
            records, sources = prepare_sources({'files': [first, second]}, root=root, cache=root/'cache')
            self.assertEqual(len(records), 2)
            self.assertEqual(len(sources), 2)
            season = next(record for record in records if record['year'] == 2015)
            raw = pd.read_csv(season['raw_path'])
            self.assertEqual(set(raw.gameid), {'shared', 'new'})
            meta = json.loads(Path(season['raw_path']).with_name('source.json').read_text())
            self.assertEqual(len(meta['annual_sources']), 2)
            self.assertEqual(meta['cross_source_exact_duplicates_removed'], 1)
            self.assertEqual(meta['raw_csv_gz_sha256'], file_hash(season['raw_path']))
            repeated, _ = prepare_sources({'files': [first, second]}, root=root, cache=root/'cache')
            self.assertEqual([r['source_sha256'] for r in records], [r['source_sha256'] for r in repeated])

    def test_year_filter_uses_source_season_across_all_annual_files(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            row = {'gameid': 'offseason', 'league': 'EU LCS', 'year': '2015', 'position': 'top'}
            first = self.source(root, 2014, [row, dict(row, gameid='old', year='2014')])
            second = self.source(root, 2015, [dict(row, gameid='regular'), dict(row, gameid='next', year='2016')])
            records, _ = prepare_sources([first, second], root=root, cache=root/'cache', years=[2015])
            self.assertEqual([record['year'] for record in records], [2015])
            self.assertEqual(set(pd.read_csv(records[0]['raw_path']).gameid), {'offseason', 'regular'})

    def test_leagues_never_share_a_snapshot(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            row = {'gameid': 'same-id', 'league': 'LPL', 'year': '2025', 'position': 'top'}
            source = self.source(root, 2025, [row, dict(row, league='LCK')])
            records, _ = prepare_sources([source], root=root, cache=root/'cache')
            self.assertEqual({r['league'] for r in records}, {'LPL', 'LCK'})
            for record in records:
                self.assertEqual(pd.read_csv(record['raw_path']).league.tolist(), [record['league']])

    def test_tampered_annual_file_fails_before_publishing(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = self.source(root, 2025, [{'gameid': 'g', 'league': 'LPL', 'year': '2025', 'position': 'top'}])
            Path(source['local_path']).write_text('not the downloaded bytes')
            with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
                prepare_sources([source], root=root, cache=root/'cache')
            self.assertFalse((root/'data/raw').exists())

    def test_tampered_cached_shard_is_rebuilt_from_verified_annual_source(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            row = {'gameid': 'original', 'league': 'LPL', 'year': '2025', 'position': 'top'}
            source = self.source(root, 2025, [row])
            prepare_sources([source], root=root/'first', cache=root/'cache')
            index = json.loads((root/'cache/shards'/source['sha256']/'index.json').read_text())
            pd.DataFrame([dict(row, gameid='corrupt')]).to_csv(index[0]['path'], index=False)
            records, _ = prepare_sources([source], root=root/'second', cache=root/'cache')
            self.assertEqual(pd.read_csv(records[0]['raw_path']).gameid.tolist(), ['original'])

    def test_receipt_cannot_hide_a_corrupt_bundle(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            record = {'path': 'lpl/2025', 'year': 2025, 'league': 'LPL'}
            hashes = {}
            for mode in ('processed', 'test'):
                folder = root/'data'/mode/record['path']
                folder.mkdir(parents=True)
                for name in BUNDLE_FILES:
                    path = folder/name
                    path.write_text(json.dumps({'metadata': {'league': 'LPL', 'season': 2025}})
                                    if name.endswith('.json') else 'id,value\nx,1\n')
                    hashes[str(path.relative_to(root))] = file_hash(path)
            report = root/'model/reports'/record['path']
            report.mkdir(parents=True)
            (report/'manifest.json').write_text(json.dumps(hashes))
            self.assertTrue(validate_bundle(root, record))
            (root/'data/processed/lpl/2025/players.csv').write_text('id,value\nx,999\n')
            with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
                validate_bundle(root, record)

    def test_slugs_are_safe_and_punctuation_does_not_collide(self):
        self.assertEqual(league_slug('LPL'), 'lpl')
        self.assertNotEqual(league_slug('EU LCS'), league_slug('EU-LCS'))
        for label in ['../../LPL', 'A/B', '赛区']:
            slug = league_slug(label)
            self.assertNotIn('/', slug)
            self.assertNotIn('..', slug)
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaisesRegex(ValueError, 'Missing bundle'):
                validate_bundle(Path(temp), {'path': 'lpl/2025', 'year': 2025, 'league': 'LPL'})


if __name__ == '__main__':
    unittest.main()
