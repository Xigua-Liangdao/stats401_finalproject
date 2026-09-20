"""Precompute the original frontend's lineup pair-impact heatmap, unchanged."""
import json
import math

from prepare import ROLES

PAIR_FIELDS = ["n_games_total", "n_games", "n_days", "mean_impact", "shrunk_impact",
               "ci_low", "ci_high", "win_rate"]


def csv_number(value):
    """Match the old frontend's Number() after the %.8f CSV export."""
    if value is None:
        return None
    number = float(value)
    return float(f"{number:.8f}") if math.isfinite(number) else None


def heatmap_payload(lineup, players, pairs):
    # buildRoster previously looked up the selected IDs in role-sorted team
    # players. Keep its last-match behavior and source names/roles.
    team_players = sorted(
        (p for p in players if p["team_id"] == lineup["team_id"]),
        key=lambda p: (ROLES.index(p["role"]), p["player"], p["player_id"]),
    )
    by_id = {p["player_id"]: p for p in team_players}
    roster = []
    for role in ROLES:
        player_id = lineup[f"{role}_id"]
        player = by_id.get(player_id)
        roster.append({"id": player_id,
                       "name": player["player"] if player else lineup[f"{role}_player"],
                       "role": player["role"] if player else None})
    selected = {player["id"] for player in roster}
    pair_map = {}
    for pair in pairs:
        if pair["team_id"] != lineup["team_id"]:
            continue
        a, b = pair["player_a_id"], pair["player_b_id"]
        if a not in selected or b not in selected:
            continue
        # Same-team pair summaries include shared games in OTHER lineups too,
        # exactly as listPairsForPlayers in the original frontend did.
        pair_map[tuple(sorted((a, b)))] = {
            "id": pair["pair_id"], "teamId": pair["team_id"], "teamName": pair["team"],
            "playerAId": a, "playerBId": b, "playerA": pair["player_a"], "playerB": pair["player_b"],
            "stats": {"eligible": str(pair["eligible"]).lower() == "true",
                      **{field: csv_number(pair[field]) for field in PAIR_FIELDS}},
        }
    cells = []
    for row, a in enumerate(roster):
        for col, b in enumerate(roster):
            pair, value, kind = None, None, "self"
            if a["id"] != b["id"]:
                pair = pair_map.get(tuple(sorted((a["id"], b["id"]))))
                value = pair["stats"]["shrunk_impact"] if pair else None
                kind = ("eligible" if pair["stats"]["eligible"] else "sparse") if value is not None else "missing"
            cells.append({"row": row, "col": col, "kind": kind, "pair": pair, "value": value})
    limit = max([.15] + [abs(cell["value"]) for cell in cells if cell["value"] is not None])
    return {"version": 1, "players": roster, "cells": cells, "limit": limit,
            "hasEligiblePair": any(pair["stats"]["eligible"] for pair in pair_map.values())}


def encode_heatmap(lineup, players, pairs):
    return json.dumps(heatmap_payload(lineup, players, pairs), ensure_ascii=False,
                      allow_nan=False, separators=(",", ":"))
