# Building the static site package

After the batch pipeline finishes and `data/datasets.json` is stable, run from the
repository root:

```sh
python3 model/scripts/build_site.py --output /path/outside/repository/finalproject-site
python3 -m http.server 8769 --directory /path/outside/repository/finalproject-site
```

Open `http://localhost:8769/view/`. The output is a standalone site root; publish
its contents as one artifact so `view/` and `data/` remain siblings. This command
only builds locally and does not publish, push, or modify source files.

The builder copies `view/`, `data/lang/`, and `data/img/` (including the actual
media manifest, `data/img/media.json`). It omits frontend tests and copies only
the processed CSVs referenced by literal `fetchCsv('filename.csv')` calls. The
current seven files are `team_panel.csv`, `players.csv`, `lineups.csv`,
`teams.csv`, `pairs.csv`, `player_games.csv`, and `lineup_games.csv`. It excludes
raw sources, test fixtures, model files, reports, unused `pair_games.csv`, and
the large unused dashboard JSONs.

Each ready dataset gets the same directory under `data/processed/`, with
`filename.csv.gz` replacing `filename.csv`. Gzip has no embedded filename and
uses `mtime=0`. The copied dataset manifest adds `compression: "gzip"` and a
`data_version` derived from the seven CSV contents; unavailable entries remain
unavailable. Language modules, image metadata, images, and the dataset manifest
remain uncompressed. The frontend decompresses the `.gz` response itself using
`DecompressionStream('gzip')`: serve those files as ordinary static gzip files
without adding a `Content-Encoding: gzip` header.

The builder calls `version_frontend.build(output_root)` after changing the copied
manifest, so import-map, entry-point, and stylesheet versions describe the
published package. The original source tree stays unchanged. The versioner can
also be checked independently:

```sh
python3 model/scripts/version_frontend.py --root /path/outside/repository/finalproject-site --check
```

The output `.stats401-site-build.json` lists every other file's relative path,
byte count, and SHA-256, plus total file count and bytes including the report
itself. Builds must be smaller than 1,000,000,000 bytes. This conservative size
check runs before installation; it does not establish compliance with every
hosting-provider limit.

Output directories must be outside the source tree and cannot be its ancestors.
The build uses a staging directory beside the destination and installs only a
complete, validated package. It can replace an intact output created by this
script. It refuses an existing directory without its ownership report, or an
output containing added, missing, or modified files. Choose another output path
to preserve manually edited files. A failed build preserves the previous
complete output. A successful rebuild updates the directory through sibling
renames; existing served requests may briefly observe the rename boundary.

Byte-for-byte reproducibility assumes the same Python/zlib compression runtime
and unchanged source bytes. Content hashes and fixed gzip metadata make changes
explicit; the report contains no local absolute paths or build timestamps.
