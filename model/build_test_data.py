"""Build data/test with the same filenames and contract as data/processed."""
from copy import deepcopy
import json
from pathlib import Path

import pandas as pd

from aggregate import aggregate
from export_data import dataset_info, export_dataset, make_schema

ROOT = Path(__file__).resolve().parents[1]


def select_sample(p):
    # A stable lineup gives the frontend enough actual evaluated games for
    # eligible player/pair rows. Preserve both complete sides of every game.
    scored = p[p.prediction_status == "out_of_time"]
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
    generated = {"player_games": sample, **aggregate(sample)}
    # Column order and declared types belong to one shared production contract.
    test_tables = {name: generated[name][table.columns] for name, table in tables.items()}
    meta = deepcopy(metadata)
    meta["dataset"] = dataset_info(test_tables, "test")
    meta["scope"] = ("Frontend integration fixture, sampled from complete processed games. "
                     "Summaries are recomputed for this subset; predictions are retained from the full pipeline. "
                     "metadata.dataset describes this subset. Source, coverage audit and evaluation describe the parent processed dataset. "
                     "This fixture is not an independent statistical test set. Cleaning decisions remain provisional.")
    players = test_tables["players"].query("eligible").sort_values(
        ["n_games", "player_id", "team_id", "role"], ascending=[False, True, True, True])
    if players.empty:
        raise ValueError("Sample has no eligible players; adjust sampling for this source.")
    player = players.iloc[0]
    team = test_tables["teams"].sort_values(["n_games", "team_id"], ascending=[False, True]).iloc[0]
    meta["examples"] = {"timeline_player_id": player.player_id, "timeline_team_id": player.team_id,
                        "timeline_role": player.role, "heatmap_team_id": team.team_id,
                        "selection_rule": "largest evaluated sample inside this test fixture; stable ID breaks ties"}
    export_dataset(destination, test_tables, meta, schema or make_schema(tables))
    return test_tables


def read_tables(source, schema):
    return {name: pd.read_csv(source / spec["file"], dtype={
        c: field["dtype"] for c, field in spec["fields"].items()})
        for name, spec in schema["tables"].items()}


def main():
    source = ROOT / "data/processed"
    schema = json.loads((source / "schema.json").read_text())
    tables = read_tables(source, schema)
    metadata = json.loads((source / "dashboard.json").read_text())["metadata"]
    test = build_test_data(tables, metadata, schema=schema)
    print(json.dumps(dataset_info(test, "test"), indent=2))


if __name__ == "__main__":
    main()
