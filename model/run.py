"""Build one isolated league/year dataset from a checksum-verified raw snapshot."""
from __future__ import annotations

import argparse
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
from dataset_paths import ROOT, dataset_paths
from export_data import SCHEMA_VERSION, dataset_info, export_dataset, write_json
from plots import make_figures, select_examples
from prepare import prepare, read_raw
from scripts.build_team_panel import build_team_panel, write_team_panel


def run_dataset(league, year, slug=None, raw_path=None, *, legacy=False, make_plots=True, root=ROOT):
    """Return a JSON-serializable registry entry only after all outputs succeed.

    Every invocation owns one league/year. Insufficient history is exported with
    null model scores; invalid or empty raw data raises and is not publishable.
    ``root`` lets tests or a caller build in an isolated staging directory.
    """
    league, year = str(league).strip(), int(year)
    paths = dataset_paths(league, year, slug, root=root, legacy=legacy, raw_path=raw_path)
    root = Path(root).resolve()
    processed, reports = paths["processed"], paths["reports"]
    reports.mkdir(parents=True, exist_ok=True)
    raw_path = paths["raw"]
    try:
        source = json.loads(raw_path.with_name("source.json").read_text())
        raw_hash = hashlib.sha256(raw_path.read_bytes()).hexdigest()
        if raw_hash != source["raw_csv_gz_sha256"]:
            raise ValueError(f"Raw snapshot checksum differs from {raw_path.with_name('source.json')}.")
        clean, quality, rejected = prepare(read_raw(raw_path), league=league, year=year)
    except (ValueError, OSError, KeyError) as error:
        failure = {"status": "unavailable", "league": league, "season": year, "reason": str(error),
                   **getattr(error, "quality", {})}
        write_json(reports / "data_quality.json", failure)
        if hasattr(error, "rejected"):
            error.rejected.to_csv(reports / "rejected_games.csv", index=False)
        raise
    print(f"{league} {year}: validated {len(clean):,} player rows / {clean.game_id.nunique():,} games.", flush=True)
    scored, evaluation, artifact = evaluate(clean)
    tables = {"player_games": scored, **aggregate(scored)}
    rejected.to_csv(reports / "rejected_games.csv", index=False)
    quality["processed_missing_values"] = {c: int(scored[c].isna().sum()) for c in scored}
    quality["raw_csv_gz_sha256"] = raw_hash
    write_json(reports / "data_quality.json", quality)
    write_json(reports / "evaluation.json", evaluation)
    write_json(reports / "fitted_model.json", artifact)
    write_json(reports / "environment.json", {"python": platform.python_version(), "pandas": pd.__version__,
               "numpy": np.__version__, "scikit_learn": sklearn.__version__})
    examples = (make_figures(tables, paths["figures"], label=f"{year} {league}") if make_plots
                else select_examples(tables))
    dataset = {**dataset_info(tables, "processed"), "id": paths["id"], "league": league, "year": year}
    metadata = {
        "schema_version": SCHEMA_VERSION, "season": year, "league": league, "source": source,
        "dataset": dataset, "coverage": quality, "evaluation": evaluation, "examples": examples,
        "score_definition": "(actual DPM - expected DPM) / training-role DPM SD",
        "player_baseline_definition": "Full-season same-role player means within this league: average each player's observed season/role values across teams, then weight players equally. Gold share, damage share, DPM and vision/min include warmup; Impact averages each player's shrunk evaluated impact. Missing values are omitted. Descriptive season reference, not a forecast.",
        "pair_definition": "mean of both players' adjusted damage per shared game; descriptive association",
        "affinity_definition": "JSON-encoded original lineup pair-impact heatmap: same-team pair summaries for the five roster IDs, including shared games in other lineups; preserves cells, scores, eligibility, detail and color limit from the frontend.",
        "shrinkage_games": SHRINKAGE_GAMES, "minimum_games": MIN_GAMES, "minimum_days": MIN_DAYS,
        "bootstrap_replicates": BOOTSTRAPS,
        "scope": "One league and source season-year, which need not equal every match's calendar year. Actual player/team/pair/lineup score summaries use out-of-time games only. n_games_total and ordinary-metric season-role baselines also include warmup. Baselines use the full observed season and weight distinct players equally.",
        "limitations": ["DPM measures damage output, not overall player value.",
                        "Pair scores do not identify causal synergy or support roster-swap predictions.",
                        "Optional metrics depend on source coverage; missing observations remain null.",
                        "Intervals resample match days with fixed fitted predictions; model uncertainty is omitted.",
                        "Models and role references are fitted separately for each league/year; scores are not cross-league strength estimates."],
    }
    schema = export_dataset(processed, tables, metadata)
    build_test_data(read_tables(processed, schema), metadata, destination=paths["test"], schema=schema)
    write_team_panel(processed, build_team_panel(processed))
    write_json(reports / "figure_selection.json", examples)
    manifest = {str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest()
                for directory in [processed, paths["test"], paths["figures"]] if directory.exists()
                for path in sorted(directory.iterdir()) if path.is_file() and path.name != ".gitkeep"}
    write_json(reports / "manifest.json", manifest)
    result = {"id": paths["id"], "league": league, "year": year, "path": paths["path"], "status": "ready",
              "games": int(scored.game_id.nunique()), "date_start": quality["date_start"], "date_end": quality["date_end"],
              "model_status": evaluation["status"], "coverage": quality,
              "paths": {name: str(value) for name, value in paths.items() if isinstance(value, Path)}}
    if "reason" in evaluation:
        result["reason"] = evaluation["reason"]
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--league")
    parser.add_argument("--year", type=int)
    parser.add_argument("--slug")
    parser.add_argument("--raw", type=Path)
    parser.add_argument("--skip-plots", action="store_true")
    args = parser.parse_args()
    if (args.league is None) != (args.year is None):
        parser.error("--league and --year must be supplied together")
    result = run_dataset(args.league or "LPL", args.year or 2025, args.slug, args.raw,
                         legacy=args.league is None, make_plots=not args.skip_plots)
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
