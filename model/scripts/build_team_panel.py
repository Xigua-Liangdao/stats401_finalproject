"""Build team_panel.csv for the team page from players.csv and lineups.csv.

Usage (from the repository root):

    python model/scripts/build_team_panel.py data/test
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

ROLES = ["top", "jng", "mid", "bot", "sup"]
REQUIRED_PLAYER = ["player_id", "player", "team_id", "team", "role", "season"]
REQUIRED_LINEUP = [
    "lineup_id", "team_id", "team", "season",
    "top_id", "top_player", "jng_id", "jng_player", "mid_id", "mid_player",
    "bot_id", "bot_player", "sup_id", "sup_player",
]
TEAM_SHORT = {
    "Anyone's Legend": "AL",
    "Bilibili Gaming": "BLG",
    "EDward Gaming": "EDG",
    "FunPlus Phoenix": "FPX",
    "Invictus Gaming": "IG",
    "JD Gaming": "JDG",
    "LGD Gaming": "LGD",
    "LNG Esports": "LNG",
    "Ninjas in Pyjamas": "NIP",
    "Oh My God": "OMG",
    "Royal Never Give Up": "RNG",
    "Team WE": "WE",
    "ThunderTalk Gaming": "TT",
    "Top Esports": "TES",
    "Ultra Prime": "UP",
    "Weibo Gaming": "WBG",
}
PANEL_COLUMNS = [
    "kind", "team_id", "team", "team_short", "season", "split",
    "player_id", "player", "role",
    "lineup_id", "lineup_name", "lineup_index", "n_games",
    "top_id", "jng_id", "mid_id", "bot_id", "sup_id",
    "top_player", "jng_player", "mid_player", "bot_player", "sup_player",
]

ROOT = Path(__file__).resolve().parents[2]


def team_short(name: str) -> str:
    if name in TEAM_SHORT:
        return TEAM_SHORT[name]
    parts = [p for p in str(name).replace("'", "").split() if p]
    if not parts:
        return "UNK"
    if len(parts) == 1:
        return parts[0][:3].upper()
    return "".join(p[0] for p in parts).upper()


def require_columns(frame: pd.DataFrame, required: list[str], filename: str) -> None:
    missing = [c for c in required if c not in frame.columns]
    if missing:
        raise ValueError(f"{filename} is missing required columns: {missing}")


def resolve_directory(raw: str) -> Path:
    path = Path(raw)
    candidates = [path, Path.cwd() / path, ROOT / path]
    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved.is_dir():
            return resolved
    raise FileNotFoundError(f"Data directory not found: {raw}")


def read_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, dtype=str, keep_default_na=False).replace("", pd.NA)


def split_by_team(directory: Path, team_ids: pd.Series) -> dict[str, str]:
    games_path = directory / "player_games.csv"
    if not games_path.exists() or "split" not in pd.read_csv(games_path, nrows=0).columns:
        return {}
    games = read_csv(games_path)
    if "team_id" not in games.columns or "split" not in games.columns:
        return {}
    games = games[games.team_id.isin(team_ids) & games.split.notna()].copy()
    if games.empty:
        return {}
    counts = (
        games.groupby(["team_id", "split"], dropna=False)
        .size()
        .reset_index(name="n")
        .sort_values(["team_id", "n", "split"], ascending=[True, False, True])
    )
    return counts.drop_duplicates("team_id").set_index("team_id")["split"].to_dict()


def empty_panel_row(**values) -> dict:
    row = {column: pd.NA for column in PANEL_COLUMNS}
    row.update(values)
    return row


def build_team_panel(directory: Path) -> pd.DataFrame:
    players_path = directory / "players.csv"
    lineups_path = directory / "lineups.csv"
    if not players_path.exists() or not lineups_path.exists():
        raise FileNotFoundError(f"Need players.csv and lineups.csv in {directory}")

    players = read_csv(players_path)
    lineups = read_csv(lineups_path)
    require_columns(players, REQUIRED_PLAYER, "players.csv")
    require_columns(lineups, REQUIRED_LINEUP, "lineups.csv")

    players["role"] = players.role.str.lower()
    players = players[players.role.isin(ROLES)].copy()
    if players.empty:
        raise ValueError("players.csv has no rows in roles top/jng/mid/bot/sup.")

    n_games_col = "n_games_total" if "n_games_total" in lineups.columns else "n_games"
    if n_games_col in lineups.columns:
        lineups["lineup_n_games"] = pd.to_numeric(lineups[n_games_col], errors="coerce").fillna(0).astype(int)
    else:
        lineups["lineup_n_games"] = 0

    team_ids = pd.Index(players.team_id.dropna().unique()).union(lineups.team_id.dropna().unique())
    splits = split_by_team(directory, team_ids)

    rows = []
    team_meta = (
        pd.concat(
            [
                players[["team_id", "team", "season"]],
                lineups[["team_id", "team", "season"]],
            ],
            ignore_index=True,
        )
        .dropna(subset=["team_id"])
        .drop_duplicates("team_id")
        .sort_values("team")
    )

    for team in team_meta.itertuples(index=False):
        short = team_short(team.team)
        split = splits.get(team.team_id, "Unknown")
        roster = players[players.team_id == team.team_id].copy()
        roster["role_order"] = roster.role.map({role: i for i, role in enumerate(ROLES)})
        roster = roster.sort_values(["role_order", "player", "player_id"], kind="stable")
        for player in roster.to_dict("records"):
            rows.append(empty_panel_row(
                kind="player",
                team_id=team.team_id,
                team=team.team,
                team_short=short,
                season=team.season,
                split=split,
                player_id=player["player_id"],
                player=player["player"],
                role=player["role"],
            ))

        compositions = lineups[lineups.team_id == team.team_id].copy()
        compositions = compositions.sort_values(["lineup_n_games", "lineup_id"], ascending=[False, True], kind="stable")
        for index, lineup in enumerate(compositions.to_dict("records"), start=1):
            rows.append(empty_panel_row(
                kind="lineup",
                team_id=team.team_id,
                team=team.team,
                team_short=short,
                season=team.season,
                split=split,
                lineup_id=lineup["lineup_id"],
                lineup_name=f"{short}-{index:02d}",
                lineup_index=index,
                n_games=lineup["lineup_n_games"],
                top_id=lineup["top_id"],
                jng_id=lineup["jng_id"],
                mid_id=lineup["mid_id"],
                bot_id=lineup["bot_id"],
                sup_id=lineup["sup_id"],
                top_player=lineup["top_player"],
                jng_player=lineup["jng_player"],
                mid_player=lineup["mid_player"],
                bot_player=lineup["bot_player"],
                sup_player=lineup["sup_player"],
            ))

    panel = pd.DataFrame(rows, columns=PANEL_COLUMNS)
    if panel.empty:
        raise ValueError("No team panel rows were produced.")
    for column in ["lineup_index", "n_games"]:
        panel[column] = pd.to_numeric(panel[column], errors="coerce").astype("Int64")
    return panel


def write_team_panel(directory: Path, panel: pd.DataFrame) -> Path:
    path = directory / "team_panel.csv"
    panel.to_csv(path, index=False, lineterminator="\n")
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build team_panel.csv from players.csv and lineups.csv.")
    parser.add_argument("directory", help='Folder with players.csv and lineups.csv, e.g. "data/test"')
    args = parser.parse_args(argv)
    directory = resolve_directory(args.directory)
    panel = build_team_panel(directory)
    path = write_team_panel(directory, panel)
    n_teams = panel.team_id.nunique()
    n_players = int((panel.kind == "player").sum())
    n_lineups = int((panel.kind == "lineup").sum())
    print(f"Wrote {path} ({n_teams} teams, {n_players} players, {n_lineups} lineups)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
