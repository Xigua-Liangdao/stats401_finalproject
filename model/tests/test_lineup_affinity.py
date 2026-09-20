"""Lineup affinity uses evaluated games of the exact five-player roster."""
import csv
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from aggregate import aggregate
from export_data import export_dataset, make_schema
from prepare import ROLES


def game_rows(game_id, day, impacts, replacement=False):
    """A complete team-game with one optional substitution in the support role."""
    rows = []
    for role, impact in zip(ROLES, impacts):
        player_id = f"player-{role}"
        if replacement and role == "sup":
            player_id += "-sub"
        rows.append({
            "game_id": game_id, "day": day, "team_id": "team-a", "team": "Team A",
            "player_id": player_id, "player": player_id, "role": role,
            "lineup_id": "lineup-sub" if replacement else "lineup-main",
            "split": "Spring", "patch": "15.1", "result": 1,
            "adjusted_impact": impact, "gold_share": .2, "damage_share": .2,
            "dpm": 500., "expected_dpm": 400. if pd.notna(impact) else np.nan,
            "vision_per_minute": 1.,
            "baseline_dpm": 450. if pd.notna(impact) else np.nan,
            "baseline_gold_share": .2 if pd.notna(impact) else np.nan,
            "baseline_damage_share": .2 if pd.notna(impact) else np.nan,
            "baseline_vision_per_minute": .9 if pd.notna(impact) else np.nan,
        })
    return rows


class LineupAffinityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        rows = game_rows("warmup", "2025-01-01", [np.nan] * 5)
        rows += game_rows("main-1", "2025-01-02", [1., 2., 3., 4., 5.])
        rows += game_rows("main-2", "2025-01-03", [3., 4., 5., 6., 7.])
        # Four players play another game together, but not as the same lineup.
        rows += game_rows("sub-1", "2025-01-04", [100.] * 5, replacement=True)
        cls.tables = aggregate(pd.DataFrame(rows))
        cls.main = cls.tables["lineups"].set_index("lineup_id").loc["lineup-main"]

    def test_affinity_is_shrunk_exact_lineup_mean(self):
        # Within-game means are 3 and 5: mean 4, with n = 2 evaluated games.
        self.assertEqual(self.main.n_games_total, 3)
        self.assertEqual(self.main.n_games, 2)
        self.assertEqual(self.main.n_days, 2)
        self.assertAlmostEqual(self.main.mean_impact, 4.)
        self.assertAlmostEqual(self.main.affinity_score, 4. * 2 / 12)
        self.assertEqual(self.main.affinity_score, self.main.shrunk_impact)
        self.assertFalse(self.main.eligible)

    def test_ten_pairs_on_same_games_equal_affinity(self):
        pairs = self.tables["pair_games"]
        shared = pairs[(pairs.lineup_id == "lineup-main") & pairs.pair_impact.notna()]
        self.assertEqual(shared.groupby("game_id").size().tolist(), [10, 10])
        pair_means = shared.groupby("pair_id").pair_impact.mean()
        self.assertEqual(len(pair_means), 10)
        self.assertAlmostEqual((pair_means * 2 / 12).mean(), self.main.affinity_score)

    def test_other_roster_games_do_not_enter_affinity(self):
        pairs = self.tables["pair_games"]
        main_pair_ids = pairs.loc[pairs.lineup_id == "lineup-main", "pair_id"]
        season_pairs = self.tables["pairs"]
        mixed_roster_average = season_pairs.loc[
            season_pairs.pair_id.isin(main_pair_ids), "shrunk_impact"
        ].mean()
        self.assertGreater(mixed_roster_average, self.main.affinity_score)
        self.assertAlmostEqual(self.main.affinity_score, 2 / 3)

    def test_only_complete_evaluated_lineup_games_count(self):
        rows = game_rows("complete", "2025-01-02", [0.] * 5)
        rows += game_rows("incomplete-score", "2025-01-03", [100., 100., 100., 100., np.nan])
        lineup = aggregate(pd.DataFrame(rows))["lineups"].iloc[0]
        self.assertEqual(lineup.n_games_total, 2)
        self.assertEqual(lineup.n_games, 1)
        self.assertEqual(lineup.affinity_score, 0.)

    def test_warmup_only_is_null_and_does_not_become_zero(self):
        rows = game_rows("warmup-only", "2025-01-01", [np.nan] * 5)
        tables = aggregate(pd.DataFrame(rows))
        lineup = tables["lineups"].iloc[0]
        self.assertEqual(lineup.n_games, 0)
        self.assertTrue(pd.isna(lineup.affinity_score))
        self.assertFalse(lineup.eligible)
        with TemporaryDirectory() as directory:
            path = Path(directory)
            export_dataset(path, tables, {})
            dashboard = json.loads((path / "dashboard.json").read_text())
            self.assertIsNone(dashboard["lineups"][0]["affinity_score"])
            with (path / "lineups.csv").open(newline="") as source:
                self.assertEqual(next(csv.DictReader(source))["affinity_score"], "")

    def test_eligibility_still_requires_games_and_days(self):
        for days, expected in [(2, False), (3, True)]:
            with self.subTest(days=days):
                rows = []
                for index in range(10):
                    rows += game_rows(f"game-{index}", f"2025-01-{1 + index % days:02d}", [2.] * 5)
                lineup = aggregate(pd.DataFrame(rows))["lineups"].iloc[0]
                self.assertEqual(lineup.affinity_score, 1.)
                self.assertEqual(bool(lineup.eligible), expected)

    def test_affinity_is_final_numeric_nullable_export_column(self):
        self.assertEqual(self.tables["lineups"].columns[-1], "affinity_score")
        schema = make_schema(self.tables)
        fields = schema["tables"]["lineups"]["fields"]
        self.assertEqual(list(fields)[-1], "affinity_score")
        # The field permits null even if every lineup in this dataset is scored.
        self.assertEqual(fields["affinity_score"], {"dtype": "float64", "nullable": True})
        with TemporaryDirectory() as directory:
            path = Path(directory)
            export_dataset(path, self.tables, {})
            with (path / "lineups.csv").open(newline="") as source:
                reader = csv.DictReader(source)
                self.assertEqual(reader.fieldnames[-1], "affinity_score")
                csv_rows = list(reader)
            dashboard = json.loads((path / "dashboard.json").read_text())
            for csv_row, json_row in zip(csv_rows, dashboard["lineups"]):
                self.assertEqual(list(json_row)[-1], "affinity_score")
                self.assertIsInstance(json_row["affinity_score"], float)
                self.assertAlmostEqual(float(csv_row["affinity_score"]), json_row["affinity_score"])


if __name__ == "__main__":
    unittest.main()
