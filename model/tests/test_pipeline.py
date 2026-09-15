"""Data-integrity and leakage checks, using actual source records as fixtures."""
import json
import sys
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from baseline import FEATURES, evaluate, make_model, predict_from_artifact
from prepare import ROLES, prepare, read_raw

ROOT = Path(__file__).resolve().parents[2]


class BackendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw = read_raw(ROOT / "data/raw/lpl_2025.csv.gz")
        cls.clean, cls.quality, _ = prepare(cls.raw)
        cls.output = pd.read_csv(ROOT / "data/processed/player_games.csv", dtype={"patch": str})
        games = cls.clean.game_id.drop_duplicates().head(2)
        cls.fixture = cls.raw[cls.raw.gameid.isin(games)].copy()

    def test_complete_games_opponents_and_shares(self):
        p = self.clean
        self.assertFalse(p.record_id.duplicated().any())
        self.assertTrue((p.groupby("game_id").size() == 10).all())
        for _, g in p.groupby(["game_id", "side"]):
            self.assertEqual(set(g.role), set(ROLES))
            self.assertAlmostEqual(g.gold_share.sum(), 1)
            self.assertAlmostEqual(g.damage_share.sum(), 1)
        opposite = p.merge(p, on=["game_id", "role"], suffixes=("_a", "_b"))
        opposite = opposite[opposite.side_a != opposite.side_b]
        self.assertTrue((opposite.opponent_player_id_a == opposite.player_id_b).all())
        self.assertTrue((opposite.opponent_team_id_a == opposite.team_id_b).all())

    def test_missing_required_value_removes_whole_game(self):
        raw = self.fixture.copy()
        i = raw[raw.position == "top"].index[0]
        broken = raw.loc[i, "gameid"]
        raw.loc[i, "damagetochampions"] = pd.NA
        clean, _, rejected = prepare(raw)
        self.assertEqual(len(clean), 10)
        self.assertNotIn(broken, set(clean.game_id))
        self.assertIn(broken, set(rejected.game_id))

    def test_exact_duplicate_and_conflicting_duplicate(self):
        row = self.fixture[self.fixture.position == "top"].iloc[[0]]
        clean, quality, _ = prepare(pd.concat([self.fixture, row], ignore_index=True))
        self.assertEqual(len(clean), 20)
        self.assertEqual(quality["exact_duplicates_removed"], 1)
        changed = row.copy()
        changed["damagetochampions"] = "99999"
        clean, _, rejected = prepare(pd.concat([self.fixture, changed], ignore_index=True))
        self.assertEqual(len(clean), 10)
        self.assertEqual(len(rejected), 1)

    def test_optional_missing_values_stay_missing(self):
        self.assertTrue(self.clean.gold_diff_at_15.isna().all())
        self.assertTrue(self.clean.xp_diff_at_15.isna().all())
        self.assertTrue(self.clean.cs_diff_at_15.isna().all())
        self.assertEqual(self.quality["excluded_player_rows"], 0)

    def test_predictions_are_strictly_out_of_time(self):
        p = self.output
        test = p[p.prediction_status == "out_of_time"]
        self.assertTrue((test.train_end_day < test.day).all())
        self.assertTrue((p.groupby("game_id").fold.nunique() == 1).all())
        self.assertTrue((p.groupby("day").fold.nunique() == 1).all())
        self.assertTrue(p.loc[p.fold == 0, "expected_dpm"].isna().all())
        self.assertTrue(p.loc[p.fold == 0, "adjusted_impact"].isna().all())
        np.testing.assert_allclose(test.adjusted_impact, (test.dpm-test.expected_dpm)/test.training_role_sd, atol=1e-7)

    def test_future_outcomes_do_not_change_earlier_predictions(self):
        days = sorted(self.clean.day.unique())[:15]
        before = self.clean[self.clean.day.isin(days)].copy()
        after = before.copy()
        after.loc[after.day == days[-1], "dpm"] *= 5
        a, _, _ = evaluate(before)
        b, _, _ = evaluate(after)
        np.testing.assert_allclose(a.loc[a.fold == 1, "expected_dpm"], b.loc[b.fold == 1, "expected_dpm"])

    def test_json_model_matches_sklearn(self):
        artifact = json.loads((ROOT / "model/reports/fitted_model.json").read_text())
        model = make_model().fit(self.clean[FEATURES], self.clean.dpm)
        sample = self.clean.iloc[::100].copy()
        sample.loc[sample.index[0], "patch"] = "unseen-patch"
        expected = np.maximum(0, model.predict(sample[FEATURES]))
        actual = predict_from_artifact(sample.to_dict("records"), artifact)
        np.testing.assert_allclose(actual, expected, atol=1e-8)

    def test_pair_and_lineup_game_counts_and_shrinkage(self):
        pg = pd.read_csv(ROOT / "data/processed/pair_games.csv")
        lg = pd.read_csv(ROOT / "data/processed/lineup_games.csv")
        pairs = pd.read_csv(ROOT / "data/processed/pairs.csv")
        self.assertTrue((pg.groupby(["game_id", "team_id"]).size() == 10).all())
        self.assertFalse(pg.duplicated(["game_id", "pair_id"]).any())
        self.assertEqual(len(lg), self.clean.game_id.nunique()*2)
        self.assertTrue((pg.player_a_id < pg.player_b_id).all())
        self.assertEqual(int(pairs.n_games.sum()), int(pg.pair_impact.notna().sum()))
        np.testing.assert_allclose(pairs.shrunk_impact, pairs.mean_impact*pairs.n_games/(pairs.n_games+10), atol=1e-7, equal_nan=True)
        self.assertTrue(pairs.loc[pairs.n_days < 3, "ci_low"].isna().all())
        self.assertTrue((pairs.eligible == ((pairs.n_games >= 10) & (pairs.n_days >= 3))).all())

    def test_json_has_no_nan_or_infinity_and_matches_csv(self):
        def invalid(value):
            raise ValueError(f"Nonstandard JSON token: {value}")
        dashboard = json.loads((ROOT / "data/processed/dashboard.json").read_text(), parse_constant=invalid)
        for name in ["players", "pairs", "lineups", "teams", "timeline"]:
            self.assertEqual(len(dashboard[name]), len(pd.read_csv(ROOT / f"data/processed/{name}.csv")))
        self.assertEqual(dashboard["metadata"]["coverage"]["processed_player_rows"], len(self.output))


if __name__ == "__main__":
    unittest.main()
