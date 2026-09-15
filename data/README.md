# Dataset and frontend contract

## Raw snapshot

`raw/lpl_2025.csv.gz` contains **9,660 rows and all 165 source columns** from Oracle's Elixir: 8,050 player-game rows and 1,610 team-game rows. It covers **805 LPL games, 99 players and 16 teams, from January 12 to September 21, 2025**, in the downloaded snapshot. This is the snapshot's observed coverage, not an independently verified complete season inventory.

- Publisher: [Oracle's Elixir downloads](https://oracleselixir.com/tools/downloads).
- Download transport: [pinned public CSV mirror](https://github.com/cbplexiglass/LoL-Esports-Regional-Analyses/blob/ff34a9f935070b7a9c9610cff423eac1fd6deddc/2025_LoL_esports_match_data_from_OraclesElixir.csv). The publisher's downloads page was inaccessible in this environment. This is a mirror of the publisher's data, not a newly collected dataset.
- `raw/source.json` records the exact URL, revision, retrieval time, row counts, full annual-file checksum and compressed LPL-snapshot checksum.
- Only league/year filtering and lossless CSV reserialization/gzip compression were applied to the raw snapshot. Source column names, string values, blank fields and team rows remain available. The full annual CSV is not committed.
- These rows carry the publisher's `partial` completeness label. This does **not** mean the core DPM/gold/vision fields are missing. Fifteen-minute gold/XP/CS differences are entirely absent; objective participation is not available for players. No such values are imputed as zero.
- Cite Oracle's Elixir in figures and derivative work. No new license is asserted for the upstream data.

## Completed processing

1. Select LPL 2025 player positions `top`, `jng`, `mid`, `bot`, `sup`; exclude team rows from player observations.
2. Trim surrounding whitespace, preserve publisher player/team IDs, parse numbers and timestamps, and keep patch as a **string** (`15.10` must not become `15.1`). Source timestamps have no timezone suffix; calendar dates are used without timezone conversion.
3. Remove exact duplicate rows. Quarantine a whole game if required fields are invalid, records conflict, ten distinct players are not present, one side lacks a role, metadata disagree, or there is not exactly one winning side. The current snapshot has **0 exact duplicates, 0 rejected games and 0 removed player rows**.
4. Join each player to the opposing team and same-role opponent. Identify lineups using team ID plus the five role-ordered player IDs. Names are display labels, not join keys.
5. Derive DPM, gold/damage shares, KDA, kill participation and vision per minute. Shares use the five actual players' totals. Missing optional fields remain null. A zero-kill team's kill participation is undefined, not zero.
6. Generate chronological held-out predictions and adjusted damage, then player, pair, team, lineup and daily summaries. See [model definitions](../model/README.md).

Audited counts and missing values: [`model/reports/data_quality.json`](../model/reports/data_quality.json). No quantile trimming or removal of valid extreme performances is performed.

## Processed files

| File in `processed/` | Unit / key | Purpose |
|---|---|---|
| `dashboard.json` | Metadata + `players`, `pairs`, `lineups`, `teams`, `timeline` arrays | Easiest static-page integration; numbers/booleans/nulls already typed |
| `player_games.csv` | One player-game, `record_id` | Detail view and arbitrary game-level filters; 8,050 rows |
| `players.csv` | Player × team × role | Resource–impact scatterplot |
| `timeline.csv` | Player × team × role × observed day | Actual/expected DPM timeline; evaluated dates only |
| `pairs.csv` | Unordered player pair × team, `pair_id` | Heatmap and network edges |
| `pair_games.csv` | Pair × team × game | Recompute pair scores after split/patch/date filtering; 10 pairs per five-player team-game |
| `lineups.csv` | Team + role-ordered five-player roster, `lineup_id` | Lineup comparison / parallel coordinates |
| `lineup_games.csv` | Lineup × game | Filterable lineup profiles; 1,610 rows |
| `teams.csv` | Team, `team_id` | Team selector and sample sizes |
| `schema.json` | Actual fields, dtypes, nullability and row counts | Machine-readable export schema |

## Field definitions

### Game-level fields

| Fields | Meaning / units |
|---|---|
| `record_id`, `game_id`, `player_id`, `team_id`, `opponent_team_id`, `opponent_player_id`, `lineup_id`, `pair_id` | String IDs. Generated IDs are deterministic hashes, not row numbers. Pair IDs include team; lineup IDs include role order. |
| `player`, `team`, `opponent_team`, `player_a`, `player_b` | Source display names; use IDs for linking |
| `date`, `day`, `season`, `split`, `playoffs`, `patch` | Source timestamp, source calendar date, integer year, source split label, 0/1 playoff flag, patch string |
| `side`, `role`, `champion`, `opponent_champion`, `role_champion` | Blue/Red; five-role code; source champion labels; role + champion interaction category |
| `result` | 1 = win, 0 = loss |
| `game_seconds`, `game_minutes` | Duration; minutes = seconds / 60 |
| `kills`, `deaths`, `assists`, `total_cs` | Player's game totals |
| `kda` | (kills + assists) / max(1, deaths) |
| `total_gold`, `damage`, `vision_score` | End-of-game total gold; total damage to champions; vision score |
| `dpm` | `damage / game_minutes` |
| `gold_share` | `total_gold / sum(total_gold of all five teammates)`; fraction 0–1. This is **total gold share**, not the source's earned-gold share. |
| `damage_share` | `damage / sum(damage of all five teammates)`; fraction 0–1 |
| `vision_per_minute` | `vision_score / game_minutes` |
| `kill_participation` | (kills + assists) / team kills; null if denominator is zero or incomplete |
| `gold_diff_at_15`, `xp_diff_at_15`, `cs_diff_at_15` | Optional source differences at minute 15; all null in this snapshot |
| `prediction_status`, `fold`, `train_end_day` | `warmup` / fold 0 / null cutoff, or `out_of_time` / folds 1–4 / last training date |
| `expected_dpm`, `baseline_dpm` | Context Ridge prediction, role-mean reference prediction; null in warmup |
| `training_role_sd` | Sample SD of DPM for this role in that fold's training set; minimum 1 |
| `adjusted_impact` | `(dpm − expected_dpm) / training_role_sd`; **adjusted damage**, not overall impact or causal value |
| `pair_impact`, `lineup_impact` | Mean adjusted damage of the two / five players for that game; null if not evaluated |
| `player_a_id`, `player_b_id` | Lexically ordered IDs for an unordered pair |
| `top_id` … `sup_id`, `top_player` … `sup_player` | Members of a role-ordered lineup |
| `top_gold_share` … `sup_gold_share`, `top_damage_share` … `sup_damage_share` | Role's resource/output share |
| `gold_concentration`, `damage_concentration` | Sum of squared role shares; 0.2 means five equal shares, 1 means all assigned to one player |

### Summary fields

All score-related summaries, win rates and resource means use **the same out-of-time subset**. Warmup games appear only in `n_games_total`. Aggregates cover the full evaluated snapshot and are not split-specific.

| Fields | Meaning |
|---|---|
| `n_games_total`, `n_games`, `n_days` | All observed games; evaluated games; distinct evaluated match days |
| `mean_impact` | Unshrunk mean adjusted damage (or pair/lineup mean) |
| `shrunk_impact` | `mean_impact × n_games / (n_games + 10)`; stabilization rule, not a fitted empirical-Bayes model |
| `ci_low`, `ci_high` | 95% day-cluster bootstrap interval for the shrunk mean, conditional on fixed fitted predictions; null below 3 days |
| `eligible` | At least 10 evaluated games and 3 match days; default display rule, not a significance test |
| `win_rate` | Fraction of evaluated games won |
| `mean_gold_share`, `mean_damage_share`, `mean_dpm`, `mean_expected_dpm`, `mean_vision_per_minute` | Arithmetic means over evaluated games |
| `actual_dpm`, `expected_dpm`, `adjusted_impact` in `timeline` | Arithmetic means over a player's evaluated games on that day; `n_games` gives weight |

**Scatterplots use `mean_impact`; heatmaps use `shrunk_impact`.** The exported confidence intervals belong to `shrunk_impact`. Do not attach them to the scatterplot's unshrunk mean.

## Frontend integration

From `view/index.html`, the path is `../data/processed/dashboard.json`:

```js
const response = await fetch('../data/processed/dashboard.json');
if (!response.ok) throw new Error(`Data load failed: ${response.status}`);
const data = await response.json();
const scatterRows = data.players.filter(d => d.eligible);
const heatmapEdges = data.pairs.filter(d => d.eligible);
const timelineRows = data.timeline.filter(d =>
  d.player_id === data.metadata.examples.timeline_player_id &&
  d.team_id === data.metadata.examples.timeline_team_id &&
  d.role === data.metadata.examples.timeline_role
);
```

For a page at repository root use `data/processed/...` instead. Serve through HTTP (`python -m http.server 8000`); browser `fetch()` generally cannot load local `file://` CSV/JSON.

- Render null values as unavailable; grey missing pair cells must not look like zero scores.
- Keep fixed diverging color limits when comparing filtered heatmaps. Show sample counts and interval scope in tooltips.
- A pair appears once; mirror it in the heatmap, keep a single edge in a network. The network remains a **planned** view.
- Team/role/minimum-game filters can select summary rows directly. **Split, patch and date filters require filtering game-level rows first and recomputing statistics.** Do not average precomputed averages or reuse whole-snapshot intervals after filtering. `model/aggregate.py:score_summary` is the reference for recomputation.
- For CSV use explicit numeric conversion and map empty numeric cells to `null`. Avoid indiscriminate `d3.autoType`, which changes patch strings.
- The 30 real rows in `data/test/sample_player_games.csv` are a deterministic integration fixture containing the first three games. They are **not** the statistical evaluation set and naturally contain warmup null predictions.

All three generated figures are under [`model/figures/`](../model/figures/) and can be embedded with ordinary `<img>` tags.
