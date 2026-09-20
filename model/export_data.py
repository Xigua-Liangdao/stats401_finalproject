"""One CSV/JSON serializer shared by processed data and frontend test fixtures."""
from copy import deepcopy
import json
from numbers import Real

import pandas as pd

SCHEMA_VERSION = "2.0.0"
SUMMARY_TABLES = ["players", "pairs", "lineups", "teams", "timeline"]
NULLABLE_FIELDS = {
    "expected_dpm", "baseline_dpm", "training_role_sd", "adjusted_impact", "train_end_day",
    "pair_impact", "lineup_impact", "mean_impact", "shrunk_impact", "ci_low", "ci_high", "win_rate",
    "gold_concentration", "damage_concentration", "gold_diff_at_15", "xp_diff_at_15", "cs_diff_at_15",
    "vision_score", "vision_per_minute", "kill_participation", "kills", "deaths", "assists", "kda", "total_cs",
}


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")


def records(frame):
    return json.loads(frame.to_json(orient="records", double_precision=8))


def field_dtype(series):
    # pandas can infer object when a numeric summary includes pd.NA. Declare
    # these as numbers so CSV and JSON consumers see the same public type.
    values = series.dropna()
    if str(series.dtype) == "object" and (
        (not values.empty and all(isinstance(v, Real) and not isinstance(v, bool) for v in values))
        or (values.empty and (series.name in NULLABLE_FIELDS or series.name.startswith("mean_")
                              or series.name.endswith("_share")))
    ):
        return "float64"
    return str(series.dtype)


def cast_table(table, fields):
    typed = table.copy()
    for c, field in fields.items():
        dtype = field["dtype"]
        if dtype.lower().startswith(("float", "int")):
            typed[c] = pd.to_numeric(typed[c], errors="raise")
        typed[c] = typed[c].astype(dtype)
    return typed


def make_schema(tables):
    return {"schema_version": SCHEMA_VERSION, "tables": {
        name: {"file": f"{name}.csv", "rows": len(table), "fields": {
            column: {"dtype": field_dtype(table[column]),
                     "nullable": bool(table[column].isna().any() or column in NULLABLE_FIELDS
                                      or column.startswith("mean_") or column.endswith("_share"))}
            for column in table}}
        for name, table in tables.items()}}


def dataset_info(tables, kind):
    p = tables["player_games"]
    return {"kind": kind, "player_rows": len(p), "games": int(p.game_id.nunique()),
            "evaluated_player_rows": int(p.expected_dpm.notna().sum()),
            "warmup_player_rows": int(p.expected_dpm.isna().sum()),
            "date_start": p.day.min(), "date_end": p.day.max(),
            "table_rows": {name: len(table) for name, table in tables.items()}}


def export_dataset(directory, tables, metadata, schema=None):
    """Reuse the processed field contract; only per-file row counts may differ."""
    directory.mkdir(parents=True, exist_ok=True)
    schema = deepcopy(schema) if schema is not None else make_schema(tables)
    if set(tables) != set(schema["tables"]):
        raise ValueError("Exported table names do not match the data contract.")
    typed = {}
    for name, table in tables.items():
        spec = schema["tables"][name]
        if list(table.columns) != list(spec["fields"]):
            raise ValueError(f"Column names/order do not match the data contract: {name}")
        typed[name] = cast_table(table, spec["fields"])
        for c, field in spec["fields"].items():
            if not field["nullable"] and typed[name][c].isna().any():
                raise ValueError(f"Unexpected null in required field: {name}.{c}")
        typed[name].to_csv(directory / spec["file"], index=False, float_format="%.8f", lineterminator="\n")
        spec["rows"] = len(table)
    dashboard = {"metadata": metadata, **{name: records(typed[name]) for name in SUMMARY_TABLES}}
    write_json(directory / "dashboard.json", dashboard)
    write_json(directory / "schema.json", schema)
    return schema
