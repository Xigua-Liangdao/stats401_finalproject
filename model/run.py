"""Run offline from the committed raw snapshot: python model/run.py."""
from __future__ import annotations

import hashlib
import json
import platform
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn

from aggregate import aggregate, BOOTSTRAPS, MIN_DAYS, MIN_GAMES, SHRINKAGE_GAMES
from baseline import evaluate
from build_test_data import build_test_data, read_tables
from export_data import SCHEMA_VERSION, dataset_info, export_dataset, write_json
from plots import make_figures
from prepare import prepare, read_raw
from scripts.build_team_panel import build_team_panel, write_team_panel

ROOT = Path(__file__).resolve().parents[1]


def main():
    processed, reports = ROOT / "data/processed", ROOT / "model/reports"
    processed.mkdir(parents=True, exist_ok=True)
    reports.mkdir(parents=True, exist_ok=True)
    raw_path = ROOT / "data/raw/lpl_2025.csv.gz"
    source = json.loads(raw_path.with_name("source.json").read_text())
    raw_hash = hashlib.sha256(raw_path.read_bytes()).hexdigest()
    if raw_hash != source["raw_csv_gz_sha256"]:
        raise ValueError("Raw snapshot checksum differs from data/raw/source.json.")
    clean, quality, rejected = prepare(read_raw(raw_path))
    print(f"Validated {len(clean):,} player rows / {clean.game_id.nunique():,} games.", flush=True)
    scored, evaluation, artifact = evaluate(clean)
    tables = aggregate(scored)
    tables = {"player_games": scored, **tables}
    rejected.to_csv(reports / "rejected_games.csv", index=False)
    quality["processed_missing_values"] = {c: int(scored[c].isna().sum()) for c in scored}
    quality["raw_csv_gz_sha256"] = raw_hash
    write_json(reports / "data_quality.json", quality)
    write_json(reports / "evaluation.json", evaluation)
    write_json(reports / "fitted_model.json", artifact)
    write_json(reports / "environment.json", {"python": platform.python_version(), "pandas": pd.__version__, "numpy": np.__version__, "scikit_learn": sklearn.__version__})
    examples = make_figures(tables, ROOT / "model/figures")
    metadata = {"schema_version": SCHEMA_VERSION, "season": 2025, "source": source,
                "dataset": dataset_info(tables, "processed"),
                "coverage": quality, "evaluation": evaluation, "examples": examples,
                "score_definition": "(actual DPM - expected DPM) / training-role DPM SD",
                "player_baseline_definition": "Full-season same-role player means: average each player's observed season/role values across teams, then weight players equally. Gold share, damage share, DPM and vision/min include warmup; Impact averages each player's shrunk evaluated impact. Missing values are omitted. Descriptive season reference, not a forecast.",
                "pair_definition": "mean of both players' adjusted damage per shared game; descriptive association",
                "affinity_definition": "JSON-encoded original lineup pair-impact heatmap: same-team pair summaries for the five roster IDs, including shared games in other lineups; preserves cells, scores, eligibility, detail and color limit from the frontend.",
                "shrinkage_games": SHRINKAGE_GAMES, "minimum_games": MIN_GAMES, "minimum_days": MIN_DAYS,
                "bootstrap_replicates": BOOTSTRAPS,
                "scope": "Actual player/team/pair/lineup score summaries use out-of-time games only. n_games_total and ordinary-metric season-role baselines also include warmup. Baselines use the full observed season and weight distinct players equally.",
                "limitations": ["DPM measures damage output, not overall player value.",
                                "Pair scores do not identify causal synergy or support roster-swap predictions.",
                                "15-minute differences and objective fields are unavailable in this snapshot.",
                                "Intervals resample match days with fixed fitted predictions; model uncertainty is omitted."]}
    schema = export_dataset(processed, tables, metadata)
    build_test_data(read_tables(processed, schema), metadata, schema=schema)
    write_team_panel(processed, build_team_panel(processed))
    write_json(reports / "figure_selection.json", examples)
    manifest = {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
                for directory in [processed, ROOT / "data/test", ROOT / "model/figures"] for path in sorted(directory.iterdir()) if path.is_file() and path.name != ".gitkeep"}
    write_json(reports / "manifest.json", manifest)
    print(json.dumps({"tables": {name: len(table) for name, table in tables.items()},
                      "context_ridge": evaluation["context_ridge"], "role_mean": evaluation["role_mean"]}, indent=2))


if __name__ == "__main__":
    main()
