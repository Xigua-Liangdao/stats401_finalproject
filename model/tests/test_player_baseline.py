"""Historical profile references must never use the evaluated game's outcomes."""
import sys
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from baseline import PROFILE_BASELINE_METRICS, evaluate
from prepare import prepare, read_raw

ROOT = Path(__file__).resolve().parents[2]
METRICS = ["dpm", *PROFILE_BASELINE_METRICS]


class PlayerBaselineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        clean, _, _ = prepare(read_raw(ROOT / "data/raw/lpl_2025.csv.gz"))
        cls.clean = clean[clean.day.isin(sorted(clean.day.unique())[:15])].copy()
        cls.scored, _, _ = evaluate(cls.clean)

    def test_references_are_earlier_same_role_means_and_warmup_is_null(self):
        p = self.scored
        for metric in METRICS:
            self.assertTrue(p.loc[p.fold == 0, f"baseline_{metric}"].isna().all())
        for fold, held in p[p.fold > 0].groupby("fold"):
            train = self.clean[self.clean.day < held.day.min()]
            self.assertTrue((held.train_end_day < held.day).all(), fold)
            for metric in METRICS:
                expected = held.role.map(train.groupby("role")[metric].mean())
                np.testing.assert_allclose(held[f"baseline_{metric}"], expected, equal_nan=True)

    def test_current_and_future_values_cannot_change_their_own_block_reference(self):
        changed = self.clean.copy()
        final_block = self.scored.fold == self.scored.fold.max()
        changed.loc[final_block, METRICS] *= 4
        after, _, _ = evaluate(changed)
        for metric in METRICS:
            np.testing.assert_allclose(self.scored[f"baseline_{metric}"], after[f"baseline_{metric}"], equal_nan=True)

    def test_missing_training_metric_stays_null_for_that_role(self):
        changed = self.clean.copy()
        first_held_day = self.scored.loc[self.scored.fold == 1, "day"].min()
        changed.loc[(changed.day < first_held_day) & (changed.role == "sup"), "vision_per_minute"] = np.nan
        after, _, _ = evaluate(changed)
        held = after[(after.fold == 1) & (after.role == "sup")]
        self.assertTrue(held.baseline_vision_per_minute.isna().all())
        self.assertTrue(held.baseline_dpm.notna().all())
        self.assertTrue(after.loc[(after.fold == 1) & (after.role == "top"), "baseline_vision_per_minute"].notna().all())

    def test_exported_player_references_use_the_players_evaluated_games(self):
        for kind in ["processed", "test"]:
            games = pd.read_csv(ROOT / f"data/{kind}/player_games.csv")
            players = pd.read_csv(ROOT / f"data/{kind}/players.csv")
            for row in players.itertuples():
                held = games[(games.player_id == row.player_id) & (games.team_id == row.team_id)
                             & (games.role == row.role) & games.adjusted_impact.notna()]
                for metric in METRICS:
                    expected = held.loc[held[metric].notna(), f"baseline_{metric}"].mean()
                    actual = getattr(row, f"mean_baseline_{metric}")
                    np.testing.assert_allclose(actual, expected, atol=1e-7, equal_nan=True)


if __name__ == "__main__":
    unittest.main()
