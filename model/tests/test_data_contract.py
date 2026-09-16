"""Assert that data/test and data/processed can use the same frontend loader."""
import csv
import json
from pathlib import Path
import sys
import unittest

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from aggregate import aggregate
from export_data import SUMMARY_TABLES

ROOT = Path(__file__).resolve().parents[2]


def read_json(path):
    def reject_constant(value):
        raise ValueError(f"Non-standard JSON number: {value}")
    return json.loads(path.read_text(), parse_constant=reject_constant)


def json_shape(value):
    if isinstance(value, dict):
        return {k: json_shape(v) for k, v in value.items()}
    if isinstance(value, list):
        return "array"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, (float, int)):
        return "number"
    return "null" if value is None else "string"


class DataContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.processed = ROOT / "data/processed"
        cls.test = ROOT / "data/test"
        cls.schema = read_json(cls.processed / "schema.json")
        cls.test_schema = read_json(cls.test / "schema.json")
        cls.frames = {}
        for directory in [cls.processed, cls.test]:
            cls.frames[directory.name] = {
                name: pd.read_csv(directory / spec["file"], dtype={
                    c: field["dtype"] for c, field in spec["fields"].items()})
                for name, spec in cls.schema["tables"].items()}

    def test_same_filenames_columns_types_and_null_contract(self):
        files = lambda directory: {p.name for p in directory.iterdir() if p.is_file() and not p.name.startswith(".")}
        extra = {"team_panel.csv"}
        self.assertEqual(files(self.processed) - extra, files(self.test) - extra)
        self.assertEqual(self.schema["schema_version"], self.test_schema["schema_version"])
        self.assertEqual(set(self.schema["tables"]), set(self.test_schema["tables"]))
        for name, spec in self.schema["tables"].items():
            self.assertEqual(spec["fields"], self.test_schema["tables"][name]["fields"], name)
            headers = []
            for directory in [self.processed, self.test]:
                with (directory / spec["file"]).open(newline="") as f:
                    headers.append(next(csv.reader(f)))
                frame = self.frames[directory.name][name]
                self.assertEqual(list(frame), list(spec["fields"]), name)
                for c, field in spec["fields"].items():
                    self.assertEqual(str(frame[c].dtype), field["dtype"], f"{name}.{c}")
                    if not field["nullable"]:
                        self.assertFalse(frame[c].isna().any(), f"{name}.{c}")
            self.assertEqual(*headers)
            self.assertEqual(self.test_schema["tables"][name]["rows"], len(self.frames["test"][name]))

    def test_json_structure_and_primitive_types_match(self):
        full = read_json(self.processed / "dashboard.json")
        sample = read_json(self.test / "dashboard.json")
        self.assertEqual(list(full), list(sample))
        self.assertEqual(json_shape(full["metadata"]), json_shape(sample["metadata"]))
        self.assertEqual(sample["metadata"]["dataset"]["kind"], "test")
        for name in SUMMARY_TABLES:
            spec = self.schema["tables"][name]
            self.assertEqual(len(sample[name]), len(self.frames["test"][name]))
            for dataset in [full, sample]:
                for row in dataset[name]:
                    self.assertEqual(list(row), list(spec["fields"]), name)
                    for c, field in spec["fields"].items():
                        value = row[c]
                        if value is None:
                            self.assertTrue(field["nullable"], f"{name}.{c}")
                        elif field["dtype"] in ["object", "string"]:
                            self.assertIsInstance(value, str, f"{name}.{c}")
                        elif field["dtype"] in ["bool", "boolean"]:
                            self.assertIsInstance(value, bool, f"{name}.{c}")
                        else:
                            self.assertIsInstance(value, (int, float), f"{name}.{c}")
                            self.assertNotIsInstance(value, bool, f"{name}.{c}")
                            self.assertTrue(np.isfinite(value), f"{name}.{c}")

    def test_sample_uses_complete_real_games_and_existing_predictions(self):
        p, t = self.frames["processed"]["player_games"], self.frames["test"]["player_games"]
        self.assertLess(len(t), len(p))
        self.assertTrue((t.groupby("game_id").size() == 10).all())
        self.assertTrue((t.groupby(["game_id", "side"]).size() == 5).all())
        self.assertEqual(set(t.prediction_status), {"warmup", "out_of_time"})
        expected = p[p.record_id.isin(t.record_id)].reset_index(drop=True)
        pd.testing.assert_frame_equal(t.reset_index(drop=True), expected)
        self.assertTrue(t.gold_diff_at_15.isna().all())
        self.assertTrue(t.patch.map(lambda v: isinstance(v, str)).all())

    def test_aggregates_are_for_the_sample_and_all_links_resolve(self):
        tables = self.frames["test"]
        recomputed = aggregate(tables["player_games"])
        for name, expected in recomputed.items():
            actual = tables[name]
            for c, field in self.schema["tables"][name]["fields"].items():
                if field["dtype"].lower().startswith(("float", "int")):
                    expected[c] = pd.to_numeric(expected[c], errors="raise")
                expected[c] = expected[c].astype(field["dtype"])
            pd.testing.assert_frame_equal(actual, expected, atol=1e-7, rtol=1e-7)
        self.assertTrue(tables["players"].eligible.any())
        self.assertTrue(tables["pairs"].eligible.any())
        self.assertTrue(tables["lineups"].eligible.any())
        self.assertFalse(tables["timeline"].empty)
        people = set(zip(tables["players"].team_id, tables["players"].player_id))
        for pair in tables["pairs"].itertuples():
            self.assertIn((pair.team_id, pair.player_a_id), people)
            self.assertIn((pair.team_id, pair.player_b_id), people)
        metadata = read_json(self.test / "dashboard.json")["metadata"]
        self.assertEqual(metadata["dataset"]["player_rows"], len(tables["player_games"]))
        example = metadata["examples"]
        self.assertIn((example["timeline_team_id"], example["timeline_player_id"]), people)
        self.assertIn(example["heatmap_team_id"], set(tables["teams"].team_id))


if __name__ == "__main__":
    unittest.main()
