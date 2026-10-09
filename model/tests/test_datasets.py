"""League/year isolation, sparse histories and optional source-field coverage."""
import hashlib
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from aggregate import aggregate
from baseline import evaluate
from dataset_paths import dataset_paths, league_slug
from export_data import make_schema
from prepare import prepare, read_raw
from run import run_dataset

ROOT = Path(__file__).resolve().parents[2]


class DatasetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        raw = read_raw(ROOT / "data/raw/lpl_2025.csv.gz")
        games = raw.gameid.drop_duplicates().head(2)
        cls.small = raw[raw.gameid.isin(games)].copy()

    def source(self, league, year, *, missing_optional=False):
        raw = self.small.copy()
        raw["league"], raw["year"] = league, str(year)
        raw["date"] = raw.date.str.replace(r"^2025", str(year), regex=True)
        if missing_optional:
            raw = raw.drop(columns=[c for c in ["kills", "deaths", "assists", "visionscore", "total cs",
                       "golddiffat15", "xpdiffat15", "csdiffat15", "playoffs", "split"] if c in raw])
        return raw

    def write_source(self, root, league, year, raw):
        paths = dataset_paths(league, year, root=root)
        path = paths["raw"]
        path.parent.mkdir(parents=True, exist_ok=True)
        raw.to_csv(path, index=False, compression="gzip")
        path.with_name("source.json").write_text(json.dumps({"source_name": "test fixture",
            "league": league, "year": year, "raw_csv_gz_sha256": hashlib.sha256(path.read_bytes()).hexdigest()}))
        return paths

    def test_prepare_selects_exact_league_and_year_before_any_join(self):
        wanted = self.source("LCK", 2024)
        others = [self.source("LPL", 2024), self.source("LCK", 2025)]
        # Duplicate source game/player IDs in the other populations must not leak.
        for other in others:
            other["damagetochampions"] = "99999999"
        selected, quality, _ = prepare(pd.concat([wanted, *others], ignore_index=True), league="LCK", year=2024)
        expected, _, _ = prepare(wanted, league="LCK", year=2024)
        pd.testing.assert_frame_equal(selected, expected)
        self.assertEqual(set(selected.season), {2024})
        self.assertEqual(quality["league"], "LCK")

    def test_source_season_year_can_differ_from_calendar_year(self):
        raw = self.source("LCK", 2015)
        raw["date"] = raw.date.str.replace(r"^2015", "2014", regex=True)
        clean, quality, _ = prepare(raw, league="LCK", year=2015)
        self.assertEqual(set(clean.season), {2015})
        self.assertTrue(clean.day.str.startswith("2014").all())
        self.assertTrue(quality["date_start"].startswith("2014"))

    def test_aggregation_and_evaluation_reject_mixed_populations(self):
        a, _, _ = prepare(self.source("LCK", 2024), league="LCK", year=2024)
        b, _, _ = prepare(self.source("LCK", 2025), league="LCK", year=2025)
        for fn in [evaluate, aggregate]:
            with self.subTest(function=fn.__name__):
                with self.assertRaisesRegex(ValueError, "exactly one"):
                    fn(pd.concat([a, b]))
                mixed = pd.concat([a.assign(league="LCK"), a.assign(league="LPL")])
                with self.assertRaisesRegex(ValueError, "exactly one league"):
                    fn(mixed)

    def test_sparse_history_keeps_missing_predictions_and_real_counts(self):
        clean, _, _ = prepare(self.source("LCK", 2024, missing_optional=True), league="LCK", year=2024)
        scored, report, artifact = evaluate(clean)
        self.assertEqual(report["status"], "insufficient_history")
        self.assertIsNone(report["context_ridge"]["mae_dpm"])
        self.assertIsNone(artifact["model_type"])
        for field in ["expected_dpm", "adjusted_impact", "baseline_dpm", "vision_per_minute", "kills", "playoffs"]:
            self.assertTrue(scored[field].isna().all(), field)
        summaries = aggregate(scored)
        for name in ["players", "pairs", "lineups", "teams"]:
            self.assertEqual(set(summaries[name].season), {2024})
            self.assertTrue((summaries[name].n_games == 0).all())
            self.assertTrue((summaries[name].n_games_total > 0).all())
            self.assertTrue(summaries[name].shrunk_impact.isna().all())
            self.assertFalse(summaries[name].eligible.any())
        self.assertTrue(summaries["timeline"].empty)
        self.assertTrue(summaries["players"].mean_baseline_dpm.notna().all())

    def test_same_contract_for_sparse_optional_and_populated_sources(self):
        schemas = []
        for missing in [False, True]:
            clean, _, _ = prepare(self.source("LCK", 2024, missing_optional=missing), league="LCK", year=2024)
            scored, _, _ = evaluate(clean)
            schemas.append(make_schema({"player_games": scored, **aggregate(scored)}))
        self.assertEqual(schemas[0], schemas[1])
        self.assertTrue(schemas[0]["tables"]["player_games"]["fields"]["playoffs"]["nullable"])

    def test_end_to_end_isolated_exports_and_graceful_empty_figures(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            expected_files = {"dashboard.json", "schema.json", "player_games.csv", "players.csv", "pairs.csv",
                              "pair_games.csv", "lineups.csv", "lineup_games.csv", "teams.csv", "timeline.csv", "team_panel.csv"}
            first_hashes = None
            for league, year in [("LCK", 2024), ("LPL", 2024), ("LCK", 2025)]:
                paths = self.write_source(root, league, year, self.source(league, year, missing_optional=True))
                result = run_dataset(league, year, root=root)
                json.dumps(result, allow_nan=False)
                self.assertEqual(result["model_status"], "insufficient_history")
                self.assertEqual(result["status"], "ready")
                self.assertEqual(result["games"], 2)
                for dataset in ["processed", "test"]:
                    self.assertEqual({p.name for p in paths[dataset].iterdir()}, expected_files)
                    data = json.loads((paths[dataset] / "dashboard.json").read_text())
                    self.assertEqual(data["metadata"]["league"], league)
                    self.assertEqual(data["metadata"]["season"], year)
                    self.assertEqual(data["metadata"]["dataset"]["id"], result["id"])
                    self.assertEqual(data["timeline"], [])
                    self.assertTrue(all(p["shrunk_impact"] is None for p in data["players"]))
                    self.assertTrue(all(p["mean_baseline_vision_per_minute"] is None for p in data["players"]))
                self.assertFalse(list(paths["figures"].glob("*.png")))
                first = root / "data/processed/lck/2024"
                hashes = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in first.iterdir()}
                if first_hashes is not None:
                    self.assertEqual(hashes, first_hashes)
                first_hashes = hashes

    def test_existing_lpl_outputs_remain_numerically_equivalent(self):
        with TemporaryDirectory() as directory:
            result = run_dataset("LPL", 2025, raw_path=ROOT / "data/raw/lpl_2025.csv.gz",
                                 root=directory, make_plots=False)
            self.assertEqual(result["model_status"], "evaluated")
            for kind in ["processed", "test"]:
                destination = Path(result["paths"][kind])
                for original in (ROOT / "data" / kind).glob("*.csv"):
                    if original.name == "team_panel.csv":
                        continue
                    # The 2.1 schema normalizes dtypes without changing numbers,
                    # warmup nulls, identities or the JSON heatmap representation.
                    kwargs = {"dtype": {"patch": str}, "keep_default_na": False, "na_values": [""]}
                    expected = pd.read_csv(original, **kwargs)
                    actual = pd.read_csv(destination / original.name, **kwargs)
                    pd.testing.assert_frame_equal(actual, expected, check_dtype=False, atol=1e-7, rtol=1e-7)

    def test_invalid_dataset_writes_audit_but_no_fake_exports(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            invalid = self.source("LCK", 2024)
            invalid["patch"] = pd.NA
            paths = self.write_source(root, "LCK", 2024, invalid)
            with self.assertRaisesRegex(ValueError, "No complete valid games"):
                run_dataset("LCK", 2024, root=root)
            audit = json.loads((paths["reports"] / "data_quality.json").read_text())
            self.assertEqual(audit["status"], "unavailable")
            self.assertEqual(audit["games"], 0)
            self.assertEqual(audit["rejected_games"], 2)
            self.assertFalse(paths["processed"].exists())

    def test_paths_reject_escape_and_legacy_cross_dataset_overwrite(self):
        with self.assertRaises(ValueError):
            dataset_paths("LCK", 2024, "../../escape")
        with self.assertRaises(ValueError):
            dataset_paths("LCK", 2024, legacy=True)
        self.assertNotEqual(league_slug("EU LCS"), league_slug("EU-LCS"))
        self.assertEqual(league_slug("LPL"), "lpl")


if __name__ == "__main__":
    unittest.main()
