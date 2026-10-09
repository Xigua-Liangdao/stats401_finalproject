"""Build data/test with the same filenames and contract as data/processed."""
from copy import deepcopy
import argparse
import json
from pathlib import Path

import pandas as pd

from aggregate import aggregate
from export_data import dataset_info, export_dataset, make_schema
from scripts.build_team_panel import build_team_panel, write_team_panel
from dataset_paths import dataset_paths

ROOT = Path(__file__).resolve().parents[1]


def select_sample(p):
    # A stable lineup gives the frontend enough actual evaluated games for
    # eligible player/pair rows. Preserve both complete sides of every game.
    scored = p[p.prediction_status == "out_of_time"]
    if scored.empty:
        selected = p.game_id.drop_duplicates().head(16)
        return p[p.game_id.isin(selected)].copy()
    counts = scored.groupby("lineup_id").game_id.nunique().sort_index().sort_values(ascending=False, kind="stable")
    focus = scored[scored.lineup_id == counts.index[0]]
    selected = set()
    selected_days = 0
    for _, day in focus.groupby("day", sort=True):
        selected.update(day.game_id)
        selected_days += 1
        if len(selected) >= 12 and selected_days >= 4:
            break
    # Include real warmup/null examples as well as valid predictions.
    selected.update(p.loc[p.prediction_status == "warmup", "game_id"].drop_duplicates().head(2))
    return p[p.game_id.isin(selected)].copy()


def build_test_data(tables, metadata, destination=ROOT / "data/test", schema=None):
    sample = select_sample(tables["player_games"])
    # Copy the already exported references exactly, rather than recomputing
    # them from rounded CSV game values (which can change the last digit).
    baseline_fields = [c for c in tables["players"] if c.startswith("mean_baseline_")]
    references = tables["players"][["season", "role", *baseline_fields]].drop_duplicates().set_index(["season", "role"])
    if references.index.has_duplicates:
        raise ValueError("Season-role baseline must be identical for all players in that season and role.")
    generated = {"player_games": sample, **aggregate(sample, baseline_reference=references)}
    # Column order and declared types belong to one shared production contract.
    test_tables = {name: generated[name][table.columns] for name, table in tables.items()}
    meta = deepcopy(metadata)
    meta["dataset"] = {**metadata.get("dataset", {}), **dataset_info(test_tables, "test")}
    meta["scope"] = ("Frontend integration fixture, sampled from complete processed games. "
                     "Player/pair/lineup statistics are recomputed for this subset; season-role player baselines "
                     "and predictions are retained from the full parent season. "
                     "metadata.dataset describes this subset. Source, coverage audit and evaluation describe the parent processed dataset. "
                     "This fixture is not an independent statistical test set. Cleaning decisions remain provisional.")
    players = test_tables["players"].query("eligible").sort_values(
        ["n_games", "player_id", "team_id", "role"], ascending=[False, True, True, True])
    player = players.iloc[0] if not players.empty else None
    team = test_tables["teams"].sort_values(["n_games", "team_id"], ascending=[False, True]).iloc[0]
    meta["examples"] = {"timeline_player_id": player.player_id if player is not None else None,
                        "timeline_team_id": player.team_id if player is not None else None,
                        "timeline_role": player.role if player is not None else None, "heatmap_team_id": team.team_id,
                        "selection_rule": "largest evaluated sample inside this test fixture; stable ID breaks ties"}
    export_dataset(destination, test_tables, meta, schema or make_schema(tables))
    write_team_panel(destination, build_team_panel(destination))
    return test_tables


def read_tables(source, schema):
    return {name: pd.read_csv(source / spec["file"], dtype={
        c: field["dtype"] for c, field in spec["fields"].items()}, keep_default_na=False, na_values=[""])
        for name, spec in schema["tables"].items()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--league")
    parser.add_argument("--year", type=int)
    parser.add_argument("--slug")
    args = parser.parse_args()
    if (args.league is None) != (args.year is None):
        parser.error("--league and --year must be supplied together")
    paths = dataset_paths(args.league or "LPL", args.year or 2025, args.slug, legacy=args.league is None)
    source = paths["processed"]
    schema = json.loads((source / "schema.json").read_text())
    tables = read_tables(source, schema)
    metadata = json.loads((source / "dashboard.json").read_text())["metadata"]
    test = build_test_data(tables, metadata, destination=paths["test"], schema=schema)
    print(json.dumps(dataset_info(test, "test"), indent=2))


if __name__ == "__main__":
    main()
