"""Context baseline, evaluated only on later calendar days."""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder

FEATURES = ["role", "role_champion", "opponent_champion", "patch", "side", "team_id", "opponent_team_id"]
ALPHA = 20.0


def make_model():
    return make_pipeline(OneHotEncoder(handle_unknown="ignore"), Ridge(alpha=ALPHA, solver="lsqr", tol=1e-8))


def metrics(actual, predicted):
    return {"mae_dpm": float(mean_absolute_error(actual, predicted)),
            "rmse_dpm": float(np.sqrt(mean_squared_error(actual, predicted))),
            "r2_dpm": float(r2_score(actual, predicted)), "rows": len(actual)}


def chronological_blocks(frame, n_blocks=5):
    """Keep every game and every same-day series entirely in one date block."""
    days = np.array(sorted(frame.day.unique()))
    if len(days) < n_blocks * 2:
        raise ValueError("Need at least 10 distinct match days for five date blocks.")
    return np.array_split(days, n_blocks)


def evaluate(frame):
    p = frame.copy()
    p["fold"] = 0
    p["prediction_status"] = "warmup"
    for c in ["expected_dpm", "baseline_dpm", "training_role_sd", "adjusted_impact"]:
        p[c] = np.nan
    p["train_end_day"] = pd.Series(pd.NA, index=p.index, dtype="string")
    folds = []
    for number, days in enumerate(chronological_blocks(p)[1:], start=1):
        train = p[p.day < days[0]]
        mask = p.day.isin(days)
        test = p.loc[mask]
        model = make_model().fit(train[FEATURES], train.dpm)
        predicted = np.maximum(0, model.predict(test[FEATURES]))
        role_mean = train.groupby("role").dpm.mean()
        role_sd = train.groupby("role").dpm.std().clip(lower=1)
        naive = test.role.map(role_mean).fillna(train.dpm.mean())
        sd = test.role.map(role_sd).fillna(max(1, train.dpm.std()))
        p.loc[mask, "expected_dpm"] = predicted
        p.loc[mask, "baseline_dpm"] = naive
        p.loc[mask, "training_role_sd"] = sd
        p.loc[mask, "adjusted_impact"] = (test.dpm - predicted) / sd
        p.loc[mask, "fold"] = number
        p.loc[mask, "prediction_status"] = "out_of_time"
        p.loc[mask, "train_end_day"] = train.day.max()
        folds.append({"fold": number, "train_start": train.day.min(), "train_end": train.day.max(),
                      "test_start": test.day.min(), "test_end": test.day.max(),
                      "train_games": train.game_id.nunique(), "test_games": test.game_id.nunique(),
                      "context_ridge": metrics(test.dpm, predicted), "role_mean": metrics(test.dpm, naive),
                      "unseen_category_fraction": {c: float((~test[c].isin(train[c])).mean()) for c in FEATURES}})
    held = p[p.prediction_status == "out_of_time"]
    report = {"target": "damage to champions per minute (DPM)", "features": FEATURES,
              "alpha": ALPHA, "hyperparameter_selection": "fixed before evaluation; no tuning on these folds",
              "protocol": "5 contiguous blocks of unique match days; block 1 warmup; expanding training for blocks 2-5",
              "warmup_rows": int((p.fold == 0).sum()), "evaluated_rows": len(held),
              "context_ridge": metrics(held.dpm, held.expected_dpm),
              "role_mean": metrics(held.dpm, held.baseline_dpm), "folds": folds,
              "by_role": {str(role): metrics(g.dpm, g.expected_dpm) for role, g in held.groupby("role")}}
    # The full-data model is for future inference only. It never supplies demo residuals.
    final = make_model().fit(p[FEATURES], p.dpm)
    encoder, regressor = final.steps[0][1], final.steps[1][1]
    weights, offset = {}, 0
    for name, categories in zip(FEATURES, encoder.categories_):
        weights[name] = {str(v): float(w) for v, w in zip(categories, regressor.coef_[offset:offset + len(categories)])}
        offset += len(categories)
    artifact = {"model_type": "one_hot_ridge_dpm", "alpha": ALPHA, "features": FEATURES,
                "intercept": float(regressor.intercept_), "weights": weights,
                "train_end_day": p.day.max(), "prediction_floor": 0,
                "usage": "Future inference only. Demo tables contain out-of-time predictions from separate folds."}
    return p, report, artifact


def predict_from_artifact(records, artifact):
    """Portable JSON model; unknown categories contribute zero, like the encoder."""
    return np.array([max(0.0, artifact["intercept"] + sum(
        artifact["weights"][name].get(str(row[name]), 0.0) for name in artifact["features"]
    )) for row in records])
