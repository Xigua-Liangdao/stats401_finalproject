"""Descriptive co-performance summaries; no causal teammate effects are inferred."""
from __future__ import annotations

from itertools import combinations

import numpy as np
import pandas as pd

from prepare import ROLES, stable_id
from baseline import PROFILE_BASELINE_METRICS

SHRINKAGE_GAMES = 10
MIN_GAMES = 10
MIN_DAYS = 3
BOOTSTRAPS = 1000


def score_summary(group, column, seed=401):
    scored = group.dropna(subset=[column])
    n = len(scored)
    clusters = scored.groupby("day")[column].agg(["sum", "count"])
    days = len(clusters)
    mean = float(scored[column].mean()) if n else np.nan
    shrink = n / (n + SHRINKAGE_GAMES)
    lower = upper = np.nan
    if days >= MIN_DAYS:
        rng = np.random.default_rng(seed)
        draws = rng.integers(days, size=(BOOTSTRAPS, days))
        # Resample full match days; games in one series are not independent draws.
        draws_mean = clusters["sum"].to_numpy()[draws].sum(axis=1) / clusters["count"].to_numpy()[draws].sum(axis=1)
        lower, upper = np.quantile(draws_mean * shrink, [.025, .975])
    return {"n_games": n, "n_days": days, "mean_impact": mean,
            "shrunk_impact": mean * shrink, "ci_low": lower, "ci_high": upper,
            "eligible": bool(n >= MIN_GAMES and days >= MIN_DAYS)}


def aggregate(p):
    players = []
    for (pid, tid, role), group in p.groupby(["player_id", "team_id", "role"], sort=True):
        scored = group.dropna(subset=["adjusted_impact"])
        players.append({"player_id": pid, "player": group.player.iloc[-1], "team_id": tid,
                        "team": group.team.iloc[-1], "role": role, "season": 2025,
                        "n_games_total": len(group), **score_summary(group, "adjusted_impact"),
                        "mean_gold_share": scored.gold_share.mean(), "mean_damage_share": scored.damage_share.mean(),
                        "mean_dpm": scored.dpm.mean(), "mean_expected_dpm": scored.expected_dpm.mean(),
                        "win_rate": scored.result.mean(), "mean_vision_per_minute": scored.vision_per_minute.mean(),
                        **{f"mean_baseline_{metric}": scored.loc[scored[metric].notna(), f"baseline_{metric}"].mean()
                           for metric in ["dpm", *PROFILE_BASELINE_METRICS]}})
    pair_games, lineup_games = [], []
    for (game_id, tid), group in p.groupby(["game_id", "team_id"], sort=True):
        context = {"game_id": game_id, "day": group.day.iloc[0], "season": 2025,
                   "split": group.split.iloc[0], "patch": group.patch.iloc[0], "team_id": tid,
                   "team": group.team.iloc[0], "lineup_id": group.lineup_id.iloc[0], "result": group.result.iloc[0]}
        for a, b in combinations(sorted(group.to_dict("records"), key=lambda row: row["player_id"]), 2):
            pair_games.append({**context, "pair_id": stable_id("pair-", [tid, a["player_id"], b["player_id"]]),
                               "player_a_id": a["player_id"], "player_b_id": b["player_id"],
                               "player_a": a["player"], "player_b": b["player"],
                               "pair_impact": (a["adjusted_impact"] + b["adjusted_impact"]) / 2})
        row = {**context, "lineup_impact": group.adjusted_impact.mean() if group.adjusted_impact.notna().all() else np.nan,
               "mean_dpm": group.dpm.mean(), "mean_vision_per_minute": group.vision_per_minute.mean(),
               "gold_concentration": float((group.gold_share ** 2).sum()),
               "damage_concentration": float((group.damage_share ** 2).sum())}
        ordered = group.set_index("role")
        for role in ROLES:
            row[f"{role}_id"] = ordered.loc[role, "player_id"]
            row[f"{role}_player"] = ordered.loc[role, "player"]
            row[f"{role}_gold_share"] = ordered.loc[role, "gold_share"]
            row[f"{role}_damage_share"] = ordered.loc[role, "damage_share"]
        lineup_games.append(row)
    pg, lg = pd.DataFrame(pair_games), pd.DataFrame(lineup_games)
    pairs = []
    for _, group in pg.groupby("pair_id", sort=True):
        row = group.iloc[-1][["pair_id", "team_id", "team", "player_a_id", "player_b_id", "player_a", "player_b", "season"]].to_dict()
        pairs.append({**row, "n_games_total": len(group), **score_summary(group, "pair_impact"),
                      "win_rate": group.loc[group.pair_impact.notna(), "result"].mean()})
    lineups = []
    for _, group in lg.groupby("lineup_id", sort=True):
        row = group.iloc[-1][["lineup_id", "team_id", "team", "season"] + [f"{r}_{s}" for r in ROLES for s in ["id", "player"]]].to_dict()
        scored = group.dropna(subset=["lineup_impact"])
        row.update({"n_games_total": len(group), **score_summary(group, "lineup_impact"), "win_rate": scored.result.mean()})
        for col in ["mean_dpm", "mean_vision_per_minute", "gold_concentration", "damage_concentration"] + [f"{r}_{s}_share" for r in ROLES for s in ["gold", "damage"]]:
            row[col] = scored[col].mean()
        # Final exported column: all ten pairs averaged over these exact-roster
        # evaluated games equal the five-player mean, with the same shrinkage.
        row["affinity_score"] = row["shrunk_impact"]
        lineups.append(row)
    teams = []
    for tid, group in lg.groupby("team_id", sort=True):
        scored = group.dropna(subset=["lineup_impact"])
        teams.append({"team_id": tid, "team": group.team.iloc[-1], "season": 2025, "n_games_total": len(group),
                      **score_summary(group, "lineup_impact"), "win_rate": scored.result.mean()})
    timeline = p[p.adjusted_impact.notna()].groupby(["player_id", "player", "team_id", "team", "role", "day"], as_index=False).agg(
        n_games=("game_id", "size"), actual_dpm=("dpm", "mean"), expected_dpm=("expected_dpm", "mean"), adjusted_impact=("adjusted_impact", "mean"))
    return {"players": pd.DataFrame(players), "pairs": pd.DataFrame(pairs), "lineups": pd.DataFrame(lineups),
            "teams": pd.DataFrame(teams), "timeline": timeline, "pair_games": pg, "lineup_games": lg}
