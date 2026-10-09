# League and season-year datasets

The site selects one Oracle's Elixir `league` label and one source `year` at a time. League labels include regional leagues, development competitions and international events. Historical labels remain distinct; for example, NA LCS and LCS are not silently merged. A source season-year can include games played in the preceding calendar year.

The checked expansion contains **509 available combinations**, **124 source labels** and **98,241 valid games** across **2014–2026**. Of these, 423 combinations have an evaluated model and 86 retain observed statistics with insufficient history for the model. The source snapshots contain 100,153 distinct game IDs within their respective datasets; 1,912 fail the existing whole-game validation and remain documented in the quality reports. Available years differ by league; the menus show actual source coverage rather than a Cartesian product of every label and year.

## Reproduce the data

Use the Python dependencies in `model/requirements.txt` (or the pinned lockfile):

```bash
python model/scripts/download_sources.py --cache /path/to/oe-cache
python model/batch.py --inventory /path/to/oe-cache/source_inventory.json --workers 4
python model/scripts/sync_media.py --coverage-output model/reports/media_coverage.json
python model/scripts/version_frontend.py
python -m unittest discover -s model/tests -v
node --test view/tests/*.test.mjs
python model/scripts/version_frontend.py --check
python -m http.server 8768
```

Open `http://localhost:8768/view/`. The browser loads native JavaScript modules and D3; no npm build is required. These commands do not publish the site.

`data/source_inventory.json` pins the 13 annual source snapshots for 2014–2026. The downloader validates downloaded bytes, decompressed CSV bytes, header and row count, and writes the local inventory used by the batch command. Annual files are downloaded once and split into all actual league/year combinations. The batch command supports `--years`, `--leagues`, `--prepared` and `--prepare-only`; omit filters to include every source label. A successful build receipt permits safe resumption when the numerical pipeline and source hash are unchanged.

**Coverage is a snapshot, not a claim that every match in history is present.** Most official Drive downloads were quota-limited during this expansion, so their publicly available mirrors are pinned to exact Git commits. Source provenance records both the official source and the mirror. The retrieved 2026 snapshot ends on **2026-07-28**, not the current date. Never infer a full-year champion from this coverage or from the highest win rate.

## Directory contract

```text
data/source_inventory.json           # Portable pinned annual-source definitions
data/datasets.json                   # Browser registry of actual dataset coverage
data/raw/<league-slug>/<year>/
  matches.csv.gz                     # Source rows, including team rows
  source.json                        # Source hashes, filters and overlapping-file provenance
data/processed/<league-slug>/<year>/  # Complete analytical dataset
data/test/<league-slug>/<year>/       # Real-game integration fixture; same file contract
model/reports/<league-slug>/<year>/    # Quality, evaluation, model, checksums and build receipt
model/figures/<league-slug>/<year>/    # Optional figures from a single-dataset run
```

Each processed/test directory has the same 11 files:

- `players.csv`, `teams.csv`, `pairs.csv`, `lineups.csv`, `timeline.csv`;
- `player_games.csv`, `pair_games.csv`, `lineup_games.csv`;
- `team_panel.csv`, `dashboard.json`, `schema.json`.

Per-machine `build.json` receipts and `build.log` execution logs are ignored by Git. Raw snapshots, processed/test exports and the quality, model and checksum reports are included in the repository; a fresh clone can serve the complete interface without rerunning the numerical pipeline.

Schema **2.1.0** preserves the existing CSV columns and affinity JSON payload. Field types are fixed by their meaning rather than each dataset's observed missing values; optional `playoffs` may now be null. League identity belongs to the registry and dashboard metadata. Data from different leagues/years is never mixed in one model run or browser data-source instance.

The original flat LPL 2025 files remain as a compatibility and numerical regression fixture. The current browser loads registry paths, not those flat files. Running `python model/run.py` without arguments rebuilds that legacy fixture. To generate one new bundle, use `python model/run.py --league LPL --year 2025 --skip-plots`; the batch runner normally supplies explicit slugs and paths.

## Registry and loading

`data/datasets.json` has `version: 1`, a default league/year and `datasets` entries:

```json
{
  "id": "lpl-2025",
  "league": "LPL",
  "year": 2025,
  "path": "lpl/2025",
  "status": "ready",
  "games": 805,
  "date_start": "2025-01-12",
  "date_end": "2025-09-21",
  "model_status": "evaluated",
  "data_version": "content-derived-version"
}
```

This is a format example, not an assertion about every regenerated source's counts. Only `ready` entries load CSVs. An `unavailable` entry retains the reason for exclusion instead of pretending to have data. Both menus come from the registry; missing combinations do not produce guessed URLs. The selected context is persisted and included in deep links. In-memory caches and in-flight requests are isolated by dataset/version, and CSV URLs carry the corresponding version.

`model/scripts/version_frontend.py` includes the registry in the release hash. Regenerate and commit `view/index.html` whenever publishing a changed registry, JavaScript, CSS or media catalogue. Wait for the hosting build and verify the public page after publication.

## Build the web release

Full analytical exports occupy more than 2 GB. Build the compressed static artifact for hosting instead of publishing the entire research tree:

```bash
python model/scripts/build_site.py --output /path/outside/the/repository/site
python -m http.server 8769 --directory /path/outside/the/repository/site
```

Open `http://localhost:8769/view/`. The artifact uses processed mode and packages only the seven CSVs that the current interface reads, alongside the JavaScript, styles, translations and images. Each copied ready registry entry has `compression: "gzip"`; the browser fetches `.csv.gz` bytes and decompresses them using `DecompressionStream`. Serve these as static files without an additional HTTP `Content-Encoding: gzip` header. Raw data, test fixtures, statistical reports and unused analytical exports remain in the research tree. D3 and Google Fonts retain the existing external CDN dependencies.

The builder regenerates the release version for the copied registry, records hashes and sizes, and checks the resulting artifact against the [GitHub Pages 1 GB published-site limit](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits). Building the artifact does not deploy it. See [site build details](../model/scripts/SITE_BUILD.md).

The verified 509-combination artifact contains 3,563 compressed CSVs and 3,820 files overall, totaling **170,215,714 bytes (162.33 MiB)**. Its build report records each published file's SHA-256 and size. The current automated checks pass **61 Python tests and 34 frontend tests**; the legacy LPL 2025 CSV values are unchanged.

HTTP smoke checks cover LPL 2025, LEC 2025/2026 and DCup 2016, including all seven compressed tables, detail data, pair/affinity values and isolated caches. Chrome checks confirm league/year switching, the player timeline, and the insufficient-history notice with null model values. All local runtime resources and referenced media files resolve in the artifact.

## Statistical and missing-data rules

Each league/year uses the existing five-block chronological Ridge method and its own position reference population. Impact remains adjusted damage rather than an absolute cross-league strength ranking. A season with fewer than ten match days exports observed games and season baselines with `model_status: insufficient_history`; model predictions and impact remain null. If no valid complete game remains, the combination is `unavailable` and its quality/rejection report explains why.

Source files can overlap in season-year. They are regrouped by the actual row labels, fully identical rows are removed, and conflicting records remain subject to whole-game validation. Missing optional fields remain null. The small `test` fixture reuses the parent bundle's predictions and full-season role references; it is not a second statistical evaluation set.

Media is matched by league, year, team and player. Existing verified LPL 2025 photos are retained. Other identities without verified assets use neutral placeholders; the media checker reports coverage rather than substituting another year or team.

## Team integration

The implementation is based on `main` at `2930f52`. The separate `xuye_ua` branch contains analytics and is not merged by this change. When integrating it, retain the league/year context in season-filter events, and update its versioning script to include both analytics modules and `data/datasets.json`. Test event receipt in Supabase separately; the data expansion's tests do not write analytics events.
