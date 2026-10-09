"""Pinned data integrity and restart behavior, using local bytes only."""
import gzip
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import download_sources as downloader

CSV = b'gameid,league,year,position,date\ng1,LPL,2025,top,2025-01-01\n'


def source(compressed=False):
    payload = gzip.compress(CSV, mtime=0) if compressed else CSV
    return {'year': 2025, 'filename': '2025.csv', 'cache_filename': '2025.csv',
            'download_filename': '2025.csv.gz' if compressed else '2025.csv',
            'download_url': 'https://example.test/fixed/2025.csv',
            'download_sha256': hashlib.sha256(payload).hexdigest(),
            'download_size_bytes': len(payload), 'sha256': hashlib.sha256(CSV).hexdigest(),
            'size_bytes': len(CSV), 'source_compression': 'gzip' if compressed else None,
            'column_count': 5, 'rows': 1, 'league_count': 1, 'source_kind': 'test_fixture'}


class DownloadSourceTests(unittest.TestCase):
    def test_complete_csv_reused_without_network(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(downloader, 'curl_download') as network:
            cache = Path(temp)
            (cache / '2025.csv').write_bytes(CSV)
            result = downloader.run({'files': [source()]}, cache)
            network.assert_not_called()
            record = result['files'][0]
            self.assertEqual(Path(record['local_path']), (cache / '2025.csv').resolve())
            self.assertEqual(json.loads((cache / 'source_inventory.json').read_text())['files'],
                             result['files'])

    def test_verify_only_does_not_replace_inventory(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(downloader, 'curl_download') as network:
            cache = Path(temp)
            (cache / '2025.csv').write_bytes(CSV)
            inventory = cache / 'source_inventory.json'
            inventory.write_text('previous inventory')
            downloader.run({'files': [source()]}, cache, verify_only=True)
            self.assertEqual(inventory.read_text(), 'previous inventory')
            network.assert_not_called()

    def test_wrong_csv_checksum_rejected_without_redownload(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(downloader, 'curl_download') as network:
            cache = Path(temp)
            (cache / '2025.csv').write_bytes(CSV.replace(b'LPL', b'LCK'))
            with self.assertRaisesRegex(ValueError, 'Checksum/size mismatch'):
                downloader.prepare_source(source(), cache)
            network.assert_not_called()

    def test_completed_partial_download_recovered_after_interruption(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(downloader, 'curl_download') as network:
            cache = Path(temp)
            partial = cache / '2025.csv.part'
            partial.write_bytes(CSV)
            downloader.prepare_source(source(), cache)
            self.assertEqual((cache / '2025.csv').read_bytes(), CSV)
            self.assertFalse(partial.exists())
            network.assert_not_called()

    def test_gzip_checksums_cover_both_downloaded_and_uncompressed_bytes(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(downloader, 'curl_download') as network:
            cache = Path(temp)
            archive = cache / '2025.csv.gz'
            archive.write_bytes(gzip.compress(CSV, mtime=0))
            downloader.prepare_source(source(compressed=True), cache)
            self.assertEqual((cache / '2025.csv').read_bytes(), CSV)
            (cache / '2025.csv').unlink()
            bad = dict(source(compressed=True), sha256='0' * 64)
            with self.assertRaisesRegex(ValueError, 'Checksum/size mismatch'):
                downloader.prepare_source(bad, cache)
            self.assertFalse((cache / '2025.csv').exists())
            self.assertFalse((cache / '2025.csv.unpacking').exists())
            network.assert_not_called()

    def test_quota_html_never_published_and_previous_inventory_preserved(self):
        def quota_page(url, path):
            path.write_text('<!DOCTYPE html><html>Download quota exceeded</html>')

        with tempfile.TemporaryDirectory() as temp, patch.object(downloader, 'curl_download', quota_page):
            cache = Path(temp)
            inventory = cache / 'source_inventory.json'
            inventory.write_text('previous complete inventory')
            with self.assertRaisesRegex(ValueError, 'Drive quota/confirmation'):
                downloader.run({'files': [source()]}, cache)
            self.assertEqual(inventory.read_text(), 'previous complete inventory')
            self.assertFalse((cache / '2025.csv').exists())

    def test_missing_csv_in_verify_only_mode_does_not_download(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(downloader, 'curl_download') as network:
            with self.assertRaisesRegex(ValueError, 'Missing cached CSV'):
                downloader.prepare_source(source(), Path(temp), verify_only=True)
            network.assert_not_called()

    def test_portable_manifest_pins_all_discovered_years_and_mirror_revisions(self):
        manifest = json.loads(downloader.DEFAULT_MANIFEST.read_text())
        self.assertEqual([r['year'] for r in manifest['files']], list(range(2014, 2027)))
        self.assertEqual([r['year'] for r in manifest['official_discovery']['files']],
                         list(range(2014, 2027)))
        self.assertNotIn('/Users/', json.dumps(manifest))
        for record in manifest['files']:
            self.assertNotIn('local_path', record)
            self.assertRegex(record['sha256'], r'^[a-f0-9]{64}$')
            self.assertRegex(record['download_sha256'], r'^[a-f0-9]{64}$')
            self.assertEqual(Path(record['cache_filename']).name, record['cache_filename'])
            if record['source_kind'] == 'pinned_github_mirror':
                self.assertRegex(record['revision'], r'^[a-f0-9]{40}$')
                self.assertIn('/' + record['revision'] + '/', record['download_url'])
        self.assertTrue(manifest['files'][-1]['date_end'].startswith('2026-07-28'))

    def test_official_listing_decodes_json_without_evaluating_javascript(self):
        entry = ['public-id', [], '2025_LoL_esports_match_data_from_OraclesElixir.csv',
                 'text/csv', 0, None, 0, 0, 0, 0, 1000, None, None, 123]
        raw = json.dumps([[entry]])
        escaped = ''.join(f'\\x{ord(char):02x}' for char in raw)
        records = downloader.parse_official_listing("window['_DRIVE_ivd'] = '" + escaped + "';")
        self.assertEqual(records[0]['year'], 2025)
        self.assertEqual(records[0]['listed_size_bytes'], 123)
        with self.assertRaisesRegex(ValueError, 'format changed'):
            downloader.parse_official_listing('<html>Access unavailable</html>')


if __name__ == '__main__':
    unittest.main()
