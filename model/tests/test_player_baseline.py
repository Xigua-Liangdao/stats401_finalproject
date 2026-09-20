"""Season-role references weight players equally and preserve full-season scope."""
import sys
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from player_baseline import PROFILE_METRICS, season_role_baselines

ROOT = Path(__file__).resolve().parents[2]
METRICS = [*PROFILE_METRICS, "impact"]


def record(player, dpm, *, season=2025, role="mid", team="a", impact=np.nan, vision=1.):
    return {"player_id": player, "season": season, "role": role, "team_id": team,
            "dpm": dpm, "gold_share": dpm / 1000, "damage_share": dpm / 1000,
            "vision_per_minute": vision, "adjusted_impact": impact}


class PlayerBaselineTests(unittest.TestCase):
    def test_equal_player_weights_merge_transfers_before_averaging(self):
        games = pd.DataFrame([
            record("a", 100, team="old"), record("a", 300, team="new", impact=2.),
            record("b", 800, impact=4.),
        ])
        reference = season_role_baselines(games, 10).loc[(2025, "mid")]
        # A's season mean is 200; B's is 800. Neither games (400) nor
        # team stints (also 400) are the units receiving equal weight.
        self.assertEqual(reference.mean_baseline_dpm, 500.)
        self.assertEqual(reference.mean_baseline_gold_share, .5)
        self.assertAlmostEqual(reference.mean_baseline_impact, 3 / 11)

    def test_seasons_and_roles_do_not_mix(self):
        games = pd.DataFrame([
            record("a", 100), record("b", 500),
            record("a", 9000, season=2024), record("c", 2000, role="top"),
        ])
        reference = season_role_baselines(games, 10)
        self.assertEqual(reference.loc[(2025, "mid"), "mean_baseline_dpm"], 300.)
        self.assertEqual(reference.loc[(2024, "mid"), "mean_baseline_dpm"], 9000.)
        self.assertEqual(reference.loc[(2025, "top"), "mean_baseline_dpm"], 2000.)

    def test_warmup_included_for_observed_metrics_but_not_impact(self):
        games = pd.DataFrame([
            record("a", 100), record("a", 300, impact=2.),
            record("b", 800, impact=4.), record("warmup-only", 1000),
        ])
        reference = season_role_baselines(games, 10).loc[(2025, "mid")]
        self.assertAlmostEqual(reference.mean_baseline_dpm, (200 + 800 + 1000) / 3)
        self.assertAlmostEqual(reference.mean_baseline_impact, 3 / 11)

    def test_missing_metrics_omit_missing_players_and_never_become_zero(self):
        games = pd.DataFrame([
            record("a", 100, vision=np.nan), record("a", 300, vision=2.),
            record("b", 800, vision=np.nan),
        ])
        games["damage_share"] = np.nan
        reference = season_role_baselines(games, 10).loc[(2025, "mid")]
        self.assertEqual(reference.mean_baseline_vision_per_minute, 2.)
        self.assertTrue(pd.isna(reference.mean_baseline_damage_share))
        self.assertTrue(pd.isna(reference.mean_baseline_impact))

    def test_exports_match_full_season_role_means_in_both_datasets(self):
        full = pd.read_csv(ROOT / "data/processed/player_games.csv")
        # Independently derive expected values from per-player seasonal records.
        per_player = full.groupby(["season", "role", "player_id"])
        expected = per_player[PROFILE_METRICS].mean()
        scores = per_player.adjusted_impact.agg(["mean", "count"])
        expected["impact"] = scores["mean"] * scores["count"] / (scores["count"] + 10)
        expected = expected.groupby(["season", "role"]).mean()
        for kind in ["processed", "test"]:
            players = pd.read_csv(ROOT / f"data/{kind}/players.csv")
            for row in players.itertuples():
                for metric in METRICS:
                    np.testing.assert_allclose(
                        getattr(row, f"mean_baseline_{metric}"), expected.loc[(row.season, row.role), metric],
                        atol=1e-7, equal_nan=True,
                    )
            # Even a player without evaluated games can see the season reference.
            warmup_only = players[players.n_games == 0]
            self.assertFalse(warmup_only.empty)
            self.assertTrue(warmup_only.mean_baseline_dpm.notna().all())

    def test_fixture_keeps_full_season_reference_instead_of_recomputing_subset(self):
        games = pd.read_csv(ROOT / "data/test/player_games.csv")
        players = pd.read_csv(ROOT / "data/test/players.csv")
        subset_reference = games.groupby(["season", "role", "player_id"]).dpm.mean().groupby(["season", "role"]).mean()
        different = [abs(row.mean_baseline_dpm - subset_reference.loc[(row.season, row.role)]) > .001
                     for row in players.itertuples()]
        self.assertTrue(any(different), "Fixture must retain full-season role reference, not its small subset mean")


if __name__ == "__main__":
    unittest.main()
