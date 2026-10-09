"""Regression checks for safe batch resumption after source/output changes."""
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from acquire import file_hash
from batch import build_one
from dataset_registry import BUNDLE_FILES


class BatchResumeTests(unittest.TestCase):
    def fixture(self, root):
        raw = root/'matches.csv.gz'
        raw.write_bytes(b'verified raw snapshot')
        record = {'id': 'lpl-2025', 'path': 'lpl/2025', 'league': 'LPL', 'year': 2025,
                  'slug': 'lpl', 'raw_path': str(raw), 'source_sha256': file_hash(raw)}
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
        manifest = report/'manifest.json'
        manifest.write_text(json.dumps(hashes))
        receipt = dict(record, pipeline_sha256='pipeline', status='ready',
                       data_version=hashlib.sha256(manifest.read_bytes()).hexdigest()[:16])
        (report/'build.json').write_text(json.dumps(receipt))
        return record, report

    def test_unchanged_source_and_outputs_resume_without_training(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            record, report = self.fixture(root)
            (report/'failure.json').write_text('stale earlier failure')
            with patch('run.run_dataset', side_effect=AssertionError('must reuse valid output')):
                result = build_one(record, str(root), 'pipeline')
            self.assertEqual(result['status'], 'ready')
            self.assertTrue(result['cached'])
            self.assertFalse((report/'failure.json').exists())

    def test_changed_raw_rejects_old_prepared_inventory(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            record, _ = self.fixture(root)
            Path(record['raw_path']).write_bytes(b'new snapshot')
            with patch('run.run_dataset', side_effect=AssertionError('stale inventory must be rejected')):
                result = build_one(record, str(root), 'pipeline')
            self.assertEqual(result['status'], 'unavailable')
            self.assertIn('Raw snapshot changed', result['reason'])

    def test_tampered_receipt_version_requires_rebuild(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            record, report = self.fixture(root)
            receipt = json.loads((report/'build.json').read_text())
            receipt['data_version'] = 'incorrect-version'
            (report/'build.json').write_text(json.dumps(receipt))
            with patch('run.run_dataset', return_value={'status': 'ready'}) as rebuild:
                result = build_one(record, str(root), 'pipeline')
            rebuild.assert_called_once()
            self.assertEqual(result['status'], 'ready')
            self.assertNotEqual(result['data_version'], 'incorrect-version')


if __name__ == '__main__':
    unittest.main()
