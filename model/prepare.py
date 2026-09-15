"""Validate complete games and derive stable keys, opponents and resource shares."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROLES = ["top", "jng", "mid", "bot", "sup"]
RENAME = {
    "gameid": "game_id", "playerid": "player_id", "playername": "player",
    "teamid": "team_id", "teamname": "team", "position": "role",
    "gamelength": "game_seconds", "damagetochampions": "damage",
    "totalgold": "total_gold", "visionscore": "vision_score",
    "total cs": "total_cs", "golddiffat15": "gold_diff_at_15",
    "xpdiffat15": "xp_diff_at_15", "csdiffat15": "cs_diff_at_15",
}
REQUIRED = ["gameid", "date", "side", "position", "playername", "teamname",
            "champion", "patch", "result", "gamelength", "damagetochampions", "totalgold"]
NUMERIC = ["result", "gamelength", "damagetochampions", "totalgold", "kills",
           "deaths", "assists", "visionscore", "total cs", "golddiffat15",
           "xpdiffat15", "csdiffat15"]


def stable_id(prefix, parts):
    key = json.dumps(list(parts), ensure_ascii=False, separators=(",", ":"))
    return prefix + hashlib.sha256(key.encode()).hexdigest()[:16]


def prepare(raw: pd.DataFrame):
    missing = set(REQUIRED + ["league", "year"]) - set(raw.columns)
    if missing:
        raise ValueError(f"Missing required source columns: {sorted(missing)}")
    report = {"raw_rows": len(raw), "raw_columns": len(raw.columns)}
    scope = raw[(raw.league == "LPL") & (raw.year.astype(str) == "2025")].copy()
    report["scope_rows"] = len(scope)
    p = scope[scope.position.isin(ROLES)].copy()
    report["player_rows_before_cleaning"] = len(p)
    report["team_rows_not_used_as_player_observations"] = int((scope.position == "team").sum())
    before = len(p)
    p = p.drop_duplicates().copy()
    report["exact_duplicates_removed"] = before - len(p)
    for c in p.select_dtypes(include=["object", "string"]).columns:
        p[c] = p[c].astype("string").str.strip().replace("", pd.NA)
    p["date"] = pd.to_datetime(p.date, errors="coerce")
    for c in NUMERIC:
        p[c] = pd.to_numeric(p[c], errors="coerce") if c in p else np.nan
    report["missing_selected_numeric_fields"] = {c: int(p[c].isna().sum()) for c in NUMERIC}
    report["completeness_labels"] = p.datacompleteness.fillna("unknown").value_counts().to_dict() if "datacompleteness" in p else {}
    invalid = p[REQUIRED].isna().any(axis=1)
    invalid |= ~np.isfinite(p[["gamelength", "damagetochampions", "totalgold"]]).all(axis=1)
    invalid |= ~p.result.isin([0, 1]) | (p.gamelength <= 0) | (p.totalgold <= 0) | (p.damagetochampions < 0)
    invalid |= ~p.side.isin(["Blue", "Red"])
    # Drop whole games, not individual teammates: shares require intact five-player sides.
    bad_games = set(p.loc[invalid, "gameid"].dropna())
    rejected = [{"game_id": str(g), "reason": "missing_or_invalid_required_field"} for g in sorted(bad_games)]
    report["rows_with_invalid_required_fields"] = int(invalid.sum())
    p = p[~invalid & ~p.gameid.isin(bad_games)].copy()
    p = p.rename(columns=RENAME)
    # Preserve publisher IDs. A named fallback is explicit and audited if an ID is absent.
    for kind in ["player", "team"]:
        col = f"{kind}_id"
        if col not in p:
            p[col] = pd.NA
        absent = p[col].isna()
        report[f"{kind}_id_fallback_rows"] = int(absent.sum())
        p.loc[absent, col] = p.loc[absent, kind].map(lambda n: stable_id(f"name-{kind}-", [n]))
    # Conflicting keys or malformed rosters are quarantined, never resolved arbitrarily.
    accepted = []
    for game_id, game in p.groupby("game_id", sort=True):
        ok = len(game) == 10 and game.side.nunique() == 2 and game.player_id.nunique() == 10
        ok &= game.team_id.nunique() == 2 and game.date.nunique() == 1
        ok &= game.patch.nunique() == 1 and game.game_seconds.nunique() == 1
        for _, team in game.groupby("side"):
            ok &= len(team) == 5 and set(team.role) == set(ROLES)
            ok &= team.team_id.nunique() == 1 and team.team.nunique() == 1 and team.result.nunique() == 1
        ok &= game.groupby("side").result.first().sum() == 1
        if ok:
            accepted.append(game_id)
        else:
            rejected.append({"game_id": str(game_id), "reason": "invalid_roster_or_conflicting_game_metadata"})
    p = p[p.game_id.isin(accepted)].copy()
    if p.empty:
        raise ValueError("No complete valid games remain.")
    p["date"] = p.date.dt.strftime("%Y-%m-%dT%H:%M:%S")
    p["day"] = p.date.str[:10]
    p["season"] = 2025
    p["split"] = p["split"].fillna("Unknown") if "split" in p else "Unknown"
    p["playoffs"] = pd.to_numeric(p["playoffs"], errors="coerce") if "playoffs" in p else np.nan
    p["game_minutes"] = p.game_seconds / 60
    p["dpm"] = p.damage / p.game_minutes
    sides = p[["game_id", "side", "team_id", "team"]].drop_duplicates()
    opponents = sides.copy()
    opponents["side"] = opponents.side.map({"Blue": "Red", "Red": "Blue"})
    opponents = opponents.rename(columns={"team_id": "opponent_team_id", "team": "opponent_team"})
    p = p.merge(opponents, on=["game_id", "side"], validate="many_to_one")
    opponent_players = p[["game_id", "side", "role", "player_id", "champion"]].copy()
    opponent_players["side"] = opponent_players.side.map({"Blue": "Red", "Red": "Blue"})
    opponent_players = opponent_players.rename(columns={"player_id": "opponent_player_id", "champion": "opponent_champion"})
    p = p.merge(opponent_players, on=["game_id", "side", "role"], validate="one_to_one")
    team_groups = p.groupby(["game_id", "side"])
    p["gold_share"] = p.total_gold / team_groups.total_gold.transform("sum")
    p["damage_share"] = p.damage / team_groups.damage.transform("sum").replace(0, np.nan)
    # Missing support fields stay missing, including partially observed team denominators.
    p["vision_per_minute"] = p.vision_score / p.game_minutes
    team_kills = team_groups.kills.transform(lambda s: s.sum(min_count=5)).replace(0, np.nan)
    p["kill_participation"] = (p.kills + p.assists) / team_kills
    p["kda"] = (p.kills + p.assists) / p.deaths.clip(lower=1)
    p["lineup_id"] = ""
    for (_, _), group in p.groupby(["game_id", "team_id"]):
        ordered = group.set_index("role").loc[ROLES]
        p.loc[group.index, "lineup_id"] = stable_id("lineup-", [group.team_id.iloc[0], *ordered.player_id])
    p["record_id"] = [stable_id("pg-", [g, pid]) for g, pid in zip(p.game_id, p.player_id)]
    p["role_champion"] = p.role + ":" + p.champion
    columns = ["record_id", "game_id", "date", "day", "season", "split", "playoffs", "patch",
               "side", "team_id", "team", "opponent_team_id", "opponent_team", "player_id", "player",
               "role", "champion", "opponent_player_id", "opponent_champion", "role_champion", "lineup_id",
               "result", "game_seconds", "game_minutes", "kills", "deaths", "assists", "kda",
               "total_gold", "damage", "total_cs", "dpm", "gold_share", "damage_share",
               "vision_score", "vision_per_minute", "kill_participation", "gold_diff_at_15", "xp_diff_at_15", "cs_diff_at_15"]
    p = p[columns].sort_values(["date", "game_id", "side", "role"]).reset_index(drop=True)
    report.update({"processed_player_rows": len(p), "games": p.game_id.nunique(),
                   "players": p.player_id.nunique(), "teams": p.team_id.nunique(),
                   "lineups": p.lineup_id.nunique(), "date_start": p.day.min(), "date_end": p.day.max(),
                   "rejected_games": len(rejected), "excluded_player_rows": report["player_rows_before_cleaning"] - len(p)})
    return p, report, pd.DataFrame(rejected, columns=["game_id", "reason"])


def read_raw(path: Path):
    return pd.read_csv(path, dtype=str, keep_default_na=False).replace("", pd.NA)
