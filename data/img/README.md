# Historical team logos and player portraits

`manifest.json` and the local PNGs are shared by **both** `data/test` and `data/processed`. No image URL columns are added to the statistical tables. The frontend loads this manifest before rendering its catalogues; it does not contact an external image host at runtime.

## Coverage

The current match dataset contains **2025 only**: 99 distinct players, 114 player/team combinations and 16 teams. This snapshot provides **112 player/team portraits and all 16 logos**. The 50 player/team combinations and 10 teams in `test` are fully covered.

Two combinations have no verified 2025 photo in the consulted archive: **Crisp / WBG** and **Xiaoxu / JDG**, both in Split 3. They are listed in `manifest.missing` and render a neutral “PHOTO UNAVAILABLE” silhouette. Their TES/RNG photos, older WBG photos and 2026 JDG photos are deliberately not substituted.

## Source and season matching

- Player photos: Leaguepedia's [2025 Split 1](https://lol.fandom.com/wiki/Category:Player_Images_-_2025_Split_1), [Split 2](https://lol.fandom.com/wiki/Category:Player_Images_-_2025_Split_2) and [Split 3](https://lol.fandom.com/wiki/Category:Player_Images_-_2025_Split_3) archives. File metadata explicitly identifies the player, team and LPL tournament. For example, [BLG Bin 2025 Split 1](https://lol.fandom.com/wiki/File:BLG_Bin_2025_Split_1.png).
- Team logos: 15 use the latest Leaguepedia **image revision on or before January 12, 2025**, the first date in the match snapshot. A logo may have been created before 2025; `season` identifies the dataset it is assigned to, not a claim that the logo was designed in that year. An archived CDN URL can contain the date it was archived/replaced; `source.uploaded_at` records the actual historical revision timestamp returned by the API.
- OMG uses the [official Tencent LPL team logo](https://lpl.qq.com/es/team_detail.shtml?tid=6), listed in the public `LOL_MATCH2_TEAM_LIST.js` registry. Its asset URL is dated January 3, 2023. This date is evidence from the URL, not a wiki revision timestamp. The archive CDN did not return bytes matching OMG’s recorded wiki checksum, so that file was not used. Tencent does not publish a source checksum; its downloaded file is pinned by local SHA-256.
- Every asset records its original file page, image URL, source metadata, upload timestamp, SHA-1 from Leaguepedia (null for Tencent), local SHA-256, and dimensions. Downloaded PNG bytes are retained; all 127 Leaguepedia files match their source SHA-1. No AI-generated portraits or edited uniforms are used.
- Source pages identify these as esports media (`EsportsFairuse`, or see the individual source page). Images and trademarks remain the property of their respective owners; this project does not relicense the source images.

The lookup key is **`season + team_id + player_id`** for portraits and **`season + team_id`** for logos. It uses Oracle's Elixir IDs, not ambiguous display names. Wei has separate BLG and IG images, for example.

If a caller supplies an explicit `player.split`, the resolver chooses an exact split photo when available, otherwise the most recent earlier split **within the same year and team**. `Split 2 Placements` uses the Split 2 rank. A Split 1 photo reused for Split 2 is still labeled **Split 1 photo** in the tooltip and manifest; this is not a claim that every split has a new photoshoot. Without a split filter, the annual catalogue uses that year's available team portrait.

`team_panel.csv` aggregates the year, and its `split` is the most common split for the team. It is **not** an individual player's photo date or a split-specific roster. Media resolution therefore does not use that team-level label to date a photo. Player links carry team/year context, and lineup members are joined by player + team + role to prevent transfer photos from being mixed.

## Reproduce and extend

```bash
# Offline: verify every image checksum, source season/team and dataset coverage.
python model/scripts/sync_media.py
# Restore missing/corrupt PNGs from the exact recorded sources, then verify.
python model/scripts/sync_media.py --download
# Frontend tests, including full-season transfer cases.
node --test view/tests/media.test.mjs
```

For another year or a newly found image, first verify the file's historical metadata, then add an explicit manifest record and local image. Never replace a 2025 entry with a current profile picture. Relevant public API queries at `https://lol.fandom.com/api.php`:

- Discover archive files with `action=query&list=categorymembers&cmtitle=Category:Player Images - 2025 Split 1&cmlimit=500&format=json` (follow continuation).
- Inspect a file with `action=query&prop=revisions|imageinfo&rvprop=content&rvslots=main&iiprop=url|timestamp|size|sha1&titles=File:BLG Bin 2025 Split 1.png&format=json`.
- For historical logos, add `iistart=2025-01-12T00:00:00Z&iilimit=1` to `prop=imageinfo`; follow file redirects. Request the returned image URL with `format=original` to preserve PNG bytes.

Keep unresolved identities in `missing` with a reason. The verification command fails for any new dataset identity that is neither mapped nor explicitly recorded as missing.
