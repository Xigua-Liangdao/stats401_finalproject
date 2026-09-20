# Baseline model and reproducible demo

This directory implements the backend for **Measuring Lineup Synergy in the LPL**. The demo narrows "performance" to **damage to champions per minute (DPM)**. It supplies a context baseline and descriptive co-performance measures. It does not yet estimate a distinct teammate interaction effect.

## Reproduce

Run from the repository root with Python 3.11+:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r model/requirements.txt
python model/run.py
python -m unittest discover -s model/tests -v
```

The committed raw snapshot makes the normal run **offline**. To fetch the same pinned annual source again, run `python model/acquire.py` first. `model/requirements-lock.txt` captures the environment used for this demo; it is optional when installing on a different supported platform.

The pipeline checks the raw checksum, validates complete games, estimates out-of-time predictions, exports CSV/JSON, creates three PNG/SVG figures, and writes reports. It does not need an API server: GitHub Pages can serve its static outputs. `reports/manifest.json` records output hashes.

Cleaning remains provisional. Both `data/test/` and `data/processed/` are exported through `export_data.py` with the same filenames and field contract. The test fixture preserves complete real games and reuses existing predictions, then recomputes its player/team and co-performance summaries. Its season-role player baselines retain the full processed season's values rather than being recomputed from the 16 sampled games. The frontend can switch directories without changing its loader. Run `python model/build_test_data.py` to regenerate the fixture from the existing processed exports.

## What the model predicts

Target: `damage to champions / game duration in minutes`.

Model: one-hot encoding followed by **Ridge regression, alpha = 20**. Features are role, role × champion, same-role opposing champion, patch, side, team ID and opponent team ID. They describe context known after the draft. Unknown categories contribute zero through the encoder. Negative DPM predictions are floored at zero. Alpha is fixed for the demo and was not selected by trying these evaluation results.

The model excludes current-game result, kills, gold, damage share, duration and objectives from the **predictors**. Duration is used only in defining the observed DPM target. Gold share is a separate descriptive scatterplot axis. Player IDs and roster interactions are not model features; residuals can therefore reflect player skill, omitted context, model error and team effects.

### Time-aware evaluation

1. Sort distinct source match days and divide them into five contiguous blocks of nearly equal numbers of days.
2. Use the first block as warmup. Fit on all earlier days and predict the next block, repeating four times.
3. All ten players, both sides and all games on the same day stay together. Encoding, the evaluation's role-mean DPM reference and role SDs are fitted from training rows only.
4. Keep warmup `expected_dpm` and `adjusted_impact` null. Do not replace them with in-sample fitted values.
5. After evaluation, fit a separate full-data model and export JSON coefficients to `reports/fitted_model.json` for future inference. It never supplies the demo residuals.

The source has **1,480 warmup rows** and **6,570 evaluated rows (657 games)**. Overall metrics on the evaluated rows:

| Method | MAE (DPM) | RMSE (DPM) | R² |
|---|---:|---:|---:|
| Earlier-data role mean | 142.205 | 189.143 | 0.502 |
| Context Ridge | 129.868 | 174.214 | 0.578 |

Lower MAE/RMSE is better. Overall R² partly reflects large differences between roles and is not proof of useful player ranking. Per-role errors, all fold boundaries and unseen-category rates are in [`reports/evaluation.json`](reports/evaluation.json). This is a baseline validation, not a final untouched holdout after model selection. Further model development requires fresh later data or nested time-aware tuning.

### Player profile baseline

The radar's **Show baseline** overlay compares a player with **all players in the same role across the full observed season**. For gold share, damage share, DPM and vision/min, first average each distinct player's observations within that season and role, then average those player means with equal weight. Resource and DPM observations include warmup games. Transfer spells are combined using `player_id`, the current player is included, and the `eligible` display flag does not restrict the reference population. Missing values are omitted separately for each metric; a player with no value for that metric is omitted from that metric's reference, and an entirely unavailable reference remains null.

`players.csv` exports these references as `mean_baseline_gold_share`, `mean_baseline_damage_share`, `mean_baseline_dpm` and `mean_baseline_vision_per_minute`. The impact axis uses `mean_baseline_impact`: compute each season-role player's mean valid evaluated adjusted damage, shrink it by `n / (n + 10)` using that player's valid evaluated-game count, then equally average those player scores. Warmup-only players do not contribute to the impact reference. Each baseline is fixed for a season and role, including across team transfers. Player summaries are keyed by `player_id`, `team_id`, `role` and `season`; the profile's actual `mean_*` values and `shrunk_impact` still summarize that player's evaluated games for the selected team, role and season.

These are descriptive, retrospective full-season references, not out-of-time forecasts or additional fitted Ridge targets. The game-level `baseline_dpm` keeps its original earlier-training-data meaning for model evaluation and the timeline, labeled **Training role mean DPM**. The full-season profile reference is labeled **Season role baseline DPM**. The two fields have different populations and purposes; the seasonal reference never supplies model predictions or adjusted damage.

## Metric definitions

For player *i* in game *g*:

```text
adjusted_impact[i,g] = (actual_dpm[i,g] − expected_dpm[i,g]) / training_role_sd[i,g]
pair_impact[a,b,g]   = (adjusted_impact[a,g] + adjusted_impact[b,g]) / 2
lineup_impact[g]     = mean(adjusted_impact of the five teammates)
shrunk_impact       = mean_impact × n_games / (n_games + 10)
affinity_score      = lineup shrunk_impact
```

`adjusted_impact` is retained as an interface field name, but charts label it **adjusted damage**. A value of +1 means one training-role standard deviation above predicted DPM. It does not mean one extra win or a causal contribution.

For a pair, average its per-game scores over games actually played together on the same team. Do not use the correlation between career averages. Pair IDs sort both player IDs and include team ID. A lineup fixes all five players, their roles and their team.

The final column of `lineups.csv`, **`affinity_score` (lineup affinity / 亲密度)**, gives that exact lineup's mean adjusted damage multiplied by `n_games / (n_games + 10)`. It equals the average of its ten pair scores when every pair uses those same evaluated lineup-games and the same shrinkage factor. Do not average season-level `pairs.csv` rows, which can include games with other rosters. This field exposes the existing descriptive co-performance definition; it is signed, is not a 0–100 scale, and does not estimate interpersonal closeness or causal synergy. Warmup-only lineups have a null score. Small samples retain their score and the existing `eligible` flag; the lineup's `ci_low` / `ci_high` also apply to this score.

### Sample size and uncertainty

- Every summary exports all-game count, evaluated-game count and number of observed match days.
- Default eligibility is **10 evaluated games and 3 match days**. Ineligible groups remain in the data for inspection.
- A 1,000-replicate bootstrap (seed 401) resamples whole match days, retaining all games on sampled days. Intervals are the 2.5% and 97.5% quantiles of the resampled mean multiplied by the original sample's `n/(n+10)` factor. Below three days, intervals are null.
- These intervals condition on the fitted predictions and observed shrinkage factor. They omit model uncertainty and possible dependence across days. They do not constitute tests of causal synergy or correct for scanning many pairs.
- Players' actual resource means and all score summaries use the same evaluated games. Season-role resource baselines additionally include warmup observations as described above. The scatterplot shows the unshrunk mean; the heatmap shows the shrunk mean.

## Three implemented visualizations

1. [`01_resource_impact.png`](figures/01_resource_impact.png): evaluated mean total-gold share versus adjusted damage, color by role and area by game count.
2. [`02_performance_timeline.png`](figures/02_performance_timeline.png): actual versus predicted DPM by observed day for the player/team/role with the most evaluated games.
3. [`03_pair_heatmap.png`](figures/03_pair_heatmap.png): shrunk pair co-performance for the team with the most evaluated games, with per-cell game counts and grey unavailable cells.

Each also has an SVG version. Examples are selected by sample coverage, with stable IDs breaking ties; they are not selected for the strongest scores. [`reports/figure_selection.json`](reports/figure_selection.json) records the selection.

## What remains for the final project

- **Synergy identification:** compare an additive player/context model with an explicitly regularized pair-interaction model on later data. Assess whether repeated roster changes supply enough overlap to separate player, team and pair effects. Until then, call scores co-performance.
- **Role validity:** DPM undervalues non-damage jobs. Compare separate damage, vision and participation measures, review errors by role and champion, and avoid asserting a universal player ranking.
- **Missing variables:** minute-15 differences and player objective participation are not supplied in this snapshot. Additional validated data are needed to include them.
- **Roster swaps:** not implemented or validated. Team effects, draft differences and roster selection prevent treating current residuals as replacement-player forecasts.
- **Visualization evaluation:** conduct the task-based study in the [demo overview](../README.md#evaluation-plan); no participant feedback has been collected yet.

## Code map

| File | Responsibility |
|---|---|
| `acquire.py` | Pinned download, LPL filtering, raw snapshot and provenance |
| `prepare.py` | Data validation, whole-game quarantine, keys, joins and shares |
| `baseline.py` | Expanding-time Ridge, reference model, metrics, portable coefficients |
| `aggregate.py` | Player/pair/lineup/team tables, bootstrap intervals and daily series |
| `plots.py` | Three actual-data static PNG/SVG figures |
| `run.py` | Offline end-to-end pipeline, CSV/JSON export, schema and manifest |
| `export_data.py` | Shared typed CSV/JSON serialization and null contract for both directories |
| `build_test_data.py` | Complete-game test sampling and consistent subset summaries |
| `tests/test_pipeline.py` | Roster integrity, missingness, time leakage, exported model and frontend data checks |
| `tests/test_data_contract.py` | Matching test/processed filenames, columns, types, JSON structure and sample links |
| `tests/test_lineup_affinity.py` | Exact-roster affinity arithmetic, pair equivalence, nulls, eligibility and final-column export |

For frontend paths, field units and filtering rules see [`data/README.md`](../data/README.md).
