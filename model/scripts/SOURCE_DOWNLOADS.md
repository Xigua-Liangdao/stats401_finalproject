# Reproducing the annual data snapshots

Run from the repository root with Python 3.9+ and `curl` installed. Choose an
external directory with at least 2 GB free for annual CSVs, compressed downloads,
and temporary files; the later batch pipeline also needs space for its outputs.
No account or token is required.

```sh
python3 model/scripts/download_sources.py --cache /path/to/oracles-elixir-cache
python3 model/batch.py --inventory /path/to/oracles-elixir-cache/source_inventory.json --cache /path/to/oracles-elixir-cache --workers 4
```

The checked-in `data/source_inventory.json` pins the exact sources used for this
snapshot. The downloader checks downloaded bytes and, for gzip sources, the
decompressed CSV separately. It reuses verified cache files and can resume a
partial download when its server supports ranges. It writes the batch inventory
only after every source verifies; errors leave the previous inventory untouched.
The emitted inventory resolves portable cache filenames into local absolute paths.
`--verify-only` verifies the existing CSVs and any cached archives without network
requests or replacing that inventory.

The manifest covers all 13 annual filenames (2014–2026) found in the official
public folder on October 9, 2026. It contains 1,201,836 rows before cross-source
deduplication, 828,390,489 CSV bytes, and 124 distinct original league labels.
Coverage includes every league label found in the acquired files, including
international and secondary competitions. This does not establish coverage of
every match ever played.

The official downloads page's JavaScript bundle linked the public Google Drive
folder. Its URL, SHA-256, discovery timestamp, file IDs, sizes, and modification
timestamps are preserved under `official_discovery`. The 2014 source downloaded
directly; public downloads for 2015–2026 returned Google Drive quota-exceeded
pages. Those years therefore use explicitly identified GitHub mirrors at fixed
commits, not assumed copies of the latest official bytes. The **2026 mirror ends
on July 28, 2026**. Earlier annual mirrors may also differ from later official
revisions. The downloader never substitutes a different source silently.

Google Drive file IDs are mutable. The pinned 2014 checksum is the acceptance
criterion; if its bytes change, its public download becomes unavailable, or its
quota is exhausted, a fresh reproduction fails clearly. A verified cached copy
still reproduces this snapshot. A quota/HTML response is never treated as CSV.

The historical 2015–2021 snapshots have 161 columns; other snapshots have 165.
Their missing columns are `atakhans`, `damagetotowers`, `firstPick`, and
`opp_atakhans`. Source filenames denote annual download bundles, while CSV
`league` and `year` fields determine the actual output folders. Some bundles
contain rows whose `year` differs from the filename. The batch process merges
all relevant annual sources and removes exact duplicate rows.

To discover updates without altering the pinned manifest:

```sh
python3 model/scripts/download_sources.py --cache /path/to/oracles-elixir-cache --discover-official
```

This saves `official_source_listing.latest.json` with current public folder
metadata. It does not download new CSVs or update checksums. To update a snapshot,
review that listing and the official downloads page, acquire the intended public
CSV (or identify a transparent mirror at a fixed commit), validate its schema and
actual year/league/date coverage, and record both downloaded and CSV hashes in a
reviewed manifest change. Re-run the downloader and batch command afterward.
Do not overwrite an existing pinned source with different bytes under its old hash.
