"""Static publish-package integrity, compression, and output ownership."""
import gzip
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import build_site
import version_frontend


class SiteBuildTests(unittest.TestCase):
    def fixture(self, base):
        root = base / 'source'
        files = {
            'view/index.html': '<html>\n  <head>\n  </head>\n<body><script type="module" src="./app.js"></script></body></html>',
            'view/app.js': "import './utils/data-source.js';\n",
            'view/utils/data-source.js': "export const load = () => fetchCsv('players.csv');\n",
            'view/utils/constants.js': "export const DATASET = 'processed';\n",
            'view/tests/not-shipped.js': 'test fixture',
            'data/lang/en/meta.js': "export const locale = 'en'; export const name = 'English';\n",
            'data/lang/en/names.js': 'export default {};\n',
            'data/img/media.json': '{"schema_version":1,"teams":[],"players":[]}',
            'data/img/team/unknown.svg': '<svg/>',
            'data/processed/lpl/2025/players.csv': 'player_id,score\np1,0.1\n',
            'data/processed/lpl/2025/dashboard.json': 'unused large dashboard',
            'data/raw/lpl/2025/matches.csv': 'private pipeline input',
            'data/test/lpl/2025/players.csv': 'test fixture',
            'model/reports/lpl/2025/report.json': '{}',
        }
        for relative, text in files.items():
            path = root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text)
        manifest = {'version': 1, 'default': {'league': 'LPL', 'year': 2025}, 'datasets': [
            {'league': 'LPL', 'year': 2025, 'status': 'ready', 'path': 'lpl/2025', 'source_sha256': 'old'},
            {'league': 'LCK', 'year': 2014, 'status': 'unavailable', 'reason': 'No valid games'},
        ]}
        (root / 'data/datasets.json').write_text(json.dumps(manifest))
        return root

    def test_gzip_package_is_reproducible_and_source_is_unchanged(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            root = self.fixture(base)
            original = {p.relative_to(root): p.read_bytes() for p in root.rglob('*') if p.is_file()}
            first, second = base / 'site-a', base / 'site-b'
            summary = build_site.build(root, first)
            build_site.build(root, second)
            a = {p.relative_to(first): p.read_bytes() for p in first.rglob('*') if p.is_file()}
            b = {p.relative_to(second): p.read_bytes() for p in second.rglob('*') if p.is_file()}
            self.assertEqual(a, b)
            self.assertEqual(summary['total_bytes'], sum(len(value) for value in a.values()))
            self.assertEqual(summary['file_count'], len(a))
            self.assertEqual(gzip.decompress(a[Path('data/processed/lpl/2025/players.csv.gz')]),
                             original[Path('data/processed/lpl/2025/players.csv')])
            self.assertFalse((first / 'data/processed/lpl/2025/players.csv').exists())
            self.assertFalse((first / 'data/processed/lpl/2025/dashboard.json').exists())
            for omitted in ['data/raw', 'data/test', 'model', 'view/tests']:
                self.assertFalse((first / omitted).exists())
            self.assertEqual(original, {p.relative_to(root): p.read_bytes() for p in root.rglob('*') if p.is_file()})
            manifest = json.loads((first / 'data/datasets.json').read_text())
            self.assertEqual(manifest['datasets'][0]['compression'], 'gzip')
            self.assertNotIn('compression', manifest['datasets'][1])
            version_frontend.build(first, check=True)

    def test_regeneration_updates_data_and_browser_versions(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            root = self.fixture(base)
            output = base / 'site'
            first = build_site.build(root, output)
            before = json.loads((output / 'data/datasets.json').read_text())['datasets'][0]['data_version']
            (root / 'data/processed/lpl/2025/players.csv').write_text('player_id,score\np1,0.2\n')
            second = build_site.build(root, output)
            after = json.loads((output / 'data/datasets.json').read_text())['datasets'][0]['data_version']
            self.assertNotEqual(before, after)
            self.assertNotEqual(first['browser_release'], second['browser_release'])
            self.assertEqual(gzip.decompress((output / 'data/processed/lpl/2025/players.csv.gz').read_bytes()),
                             b'player_id,score\np1,0.2\n')

    def test_missing_csv_preserves_previous_complete_output(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            root = self.fixture(base)
            output = base / 'site'
            build_site.build(root, output)
            old_report = (output / build_site.REPORT).read_bytes()
            (root / 'data/processed/lpl/2025/players.csv').unlink()
            with self.assertRaisesRegex(ValueError, 'Missing or external'):
                build_site.build(root, output)
            self.assertEqual((output / build_site.REPORT).read_bytes(), old_report)
            self.assertFalse(list(base.glob('.site-building-*')))

    def test_unmanaged_or_modified_output_is_never_removed(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            root = self.fixture(base)
            unmanaged = base / 'personal'
            unmanaged.mkdir()
            (unmanaged / 'keep.txt').write_text('personal file')
            with self.assertRaisesRegex(ValueError, 'unmanaged'):
                build_site.build(root, unmanaged)
            self.assertEqual((unmanaged / 'keep.txt').read_text(), 'personal file')
            output = base / 'site'
            build_site.build(root, output)
            (output / 'extra.txt').write_text('added by user')
            with self.assertRaisesRegex(ValueError, 'added or missing'):
                build_site.build(root, output)
            self.assertTrue((output / 'extra.txt').is_file())
            (output / 'extra.txt').unlink()
            (output / 'view/app.js').write_text('changed by user')
            with self.assertRaisesRegex(ValueError, 'was modified'):
                build_site.build(root, output)

    def test_overlapping_output_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            root = self.fixture(base)
            for output in [root, root / 'release', base]:
                with self.subTest(output=output), self.assertRaisesRegex(ValueError, 'separate'):
                    build_site.build(root, output)

    def test_oversized_package_is_not_installed(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            root = self.fixture(base)
            output = base / 'site'
            with self.assertRaisesRegex(ValueError, 'must be smaller'):
                build_site.build(root, output, max_bytes=100)
            self.assertFalse(output.exists())
            self.assertFalse(list(base.glob('.site-building-*')))

    def test_unsafe_dataset_path_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            root = self.fixture(base)
            path = root / 'data/datasets.json'
            manifest = json.loads(path.read_text())
            manifest['datasets'][0]['path'] = '../../outside'
            path.write_text(json.dumps(manifest))
            with self.assertRaisesRegex(ValueError, 'unsafe paths'):
                build_site.build(root, base / 'site')


if __name__ == '__main__':
    unittest.main()
