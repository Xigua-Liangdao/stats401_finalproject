"""Lineup affinity preserves the original same-team pair heatmap."""
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
from lineup_affinity import heatmap_payload
from prepare import ROLES


def game_rows(game_id, day, impacts, replacement=False):
    """A complete team-game with one optional substitution in the support role."""
    rows = []
    for role, impact in zip(ROLES, impacts):
        player_id = f"player-{role}"
        if replacement and role == "sup":
            player_id += "-sub"
        rows.append({
            "game_id": game_id, "day": day, "season": 2025, "team_id": "team-a", "team": "Team A",
            "player_id": player_id, "player": player_id, "role": role,
            "lineup_id": "lineup-sub" if replacement else "lineup-main",
            "split": "Spring", "patch": "15.1", "result": 1,
            "adjusted_impact": impact, "gold_share": .2, "damage_share": .2,
            "dpm": 500., "expected_dpm": 400. if pd.notna(impact) else np.nan,
            "vision_per_minute": 1.,
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

    def test_other_roster_games_enter_matching_pairs_but_not_exact_lineup_summary(self):
        payload = json.loads(self.main.affinity_score)
        top_jng = payload["cells"][1]
        top_sup = payload["cells"][4]
        # Top/jungle impacts 1.5, 3.5 and 100 include the substitute lineup.
        self.assertEqual(top_jng["value"], round(105 / 13, 8))
        self.assertEqual(top_jng["pair"]["stats"]["n_games_total"], 4)
        self.assertEqual(top_jng["pair"]["stats"]["n_games"], 3)
        self.assertEqual(top_jng["pair"]["stats"]["n_days"], 3)
        self.assertIsNotNone(top_jng["pair"]["stats"]["ci_low"])
        self.assertEqual(top_jng["kind"], "sparse")
        # Original support has just the two evaluated shared games (3 and 5).
        self.assertEqual(top_sup["value"], round(8 / 12, 8))
        self.assertEqual(top_sup["pair"]["stats"]["n_games"], 2)
        self.assertIsNone(top_sup["pair"]["stats"]["ci_low"])
        self.assertAlmostEqual(self.main.shrunk_impact, 2 / 3)
        self.assertEqual(payload["limit"], round(109 / 13, 8))

    def test_ten_pair_values_are_symmetric_with_null_diagonal(self):
        payload = json.loads(self.main.affinity_score)
        self.assertEqual([p["role"] for p in payload["players"]], ROLES)
        self.assertEqual(len(payload["cells"]), 25)
        for cell in payload["cells"]:
            row, col = cell["row"], cell["col"]
            if row == col:
                self.assertEqual(cell, {"row": row, "col": col, "kind": "self", "pair": None, "value": None})
            else:
                other = payload["cells"][col * 5 + row]
                self.assertEqual(cell["value"], other["value"])
                self.assertEqual(cell["pair"], other["pair"])
        self.assertEqual(len({cell["pair"]["id"] for cell in payload["cells"] if cell["pair"]}), 10)

    def test_incomplete_lineup_scores_do_not_hide_valid_pair_scores_or_zero(self):
        rows = game_rows("complete", "2025-01-02", [0.] * 5)
        rows += game_rows("incomplete-score", "2025-01-03", [100., 100., 100., 100., np.nan])
        lineup = aggregate(pd.DataFrame(rows))["lineups"].iloc[0]
        self.assertEqual(lineup.n_games_total, 2)
        self.assertEqual(lineup.n_games, 1)
        payload = json.loads(lineup.affinity_score)
        self.assertEqual(payload["cells"][1]["value"], round(100 / 12, 8))
        self.assertEqual(payload["cells"][4]["value"], 0.)
        self.assertEqual(payload["cells"][4]["kind"], "sparse")

    def test_warmup_only_is_null_and_does_not_become_zero(self):
        rows = game_rows("warmup-only", "2025-01-01", [np.nan] * 5)
        tables = aggregate(pd.DataFrame(rows))
        lineup = tables["lineups"].iloc[0]
        self.assertEqual(lineup.n_games, 0)
        payload = json.loads(lineup.affinity_score)
        self.assertTrue(all(cell["value"] is None for cell in payload["cells"]))
        self.assertEqual(payload["cells"][1]["kind"], "missing")
        self.assertIsNotNone(payload["cells"][1]["pair"])
        self.assertEqual(payload["limit"], .15)
        self.assertFalse(payload["hasEligiblePair"])
        self.assertFalse(lineup.eligible)
        with TemporaryDirectory() as directory:
            path = Path(directory)
            export_dataset(path, tables, {})
            dashboard = json.loads((path / "dashboard.json").read_text())
            self.assertEqual(json.loads(dashboard["lineups"][0]["affinity_score"]), payload)
            with (path / "lineups.csv").open(newline="") as source:
                self.assertEqual(json.loads(next(csv.DictReader(source))["affinity_score"]), payload)

    def test_other_teams_and_unselected_players_are_excluded_and_absent_pairs_are_missing(self):
        lineup = self.main.to_dict()
        players = self.tables["players"].to_dict("records")
        pairs = self.tables["pairs"].to_dict("records")
        wanted = next(p for p in pairs if {p["player_a_id"], p["player_b_id"]} == {"player-top", "player-jng"})
        pairs = [p for p in pairs if p["pair_id"] != wanted["pair_id"]]
        pairs.append({**wanted, "team_id": "other-team", "shrunk_impact": 10000.})
        payload = heatmap_payload(lineup, players, pairs)
        self.assertEqual(payload["cells"][1]["kind"], "missing")
        self.assertIsNone(payload["cells"][1]["pair"])
        self.assertLess(payload["limit"], 10000.)
        self.assertTrue(all("-sub" not in json.dumps(c["pair"]) for c in payload["cells"]))

    def test_eligibility_still_requires_games_and_days(self):
        for days, expected in [(2, False), (3, True)]:
            with self.subTest(days=days):
                rows = []
                for index in range(10):
                    rows += game_rows(f"game-{index}", f"2025-01-{1 + index % days:02d}", [2.] * 5)
                lineup = aggregate(pd.DataFrame(rows))["lineups"].iloc[0]
                payload = json.loads(lineup.affinity_score)
                self.assertEqual(payload["cells"][1]["value"], 1.)
                self.assertEqual(payload["cells"][1]["kind"], "eligible" if expected else "sparse")
                self.assertEqual(payload["hasEligiblePair"], expected)

    def test_affinity_is_final_required_json_string_export_column(self):
        self.assertEqual(self.tables["lineups"].columns[-1], "affinity_score")
        schema = make_schema(self.tables)
        fields = schema["tables"]["lineups"]["fields"]
        self.assertEqual(list(fields)[-1], "affinity_score")
        self.assertEqual(fields["affinity_score"], {"dtype": "object", "nullable": False})
        self.assertEqual(schema["schema_version"], "2.0.0")
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
                self.assertIsInstance(json_row["affinity_score"], str)
                self.assertEqual(csv_row["affinity_score"], json_row["affinity_score"])
                self.assertEqual(json.loads(csv_row["affinity_score"])["version"], 1)


if __name__ == "__main__":
    unittest.main()
