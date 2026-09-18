import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  setMediaManifest, playerImageAsset, playerImageUrl, teamLogoUrl,
  PLAYER_IMAGE_FALLBACK, TEAM_LOGO_FALLBACK,
} from '../utils/assets.js';
import { href, parseHash } from '../utils/navigation.js';

const manifest = JSON.parse(await readFile(new URL('../../data/img/manifest.json', import.meta.url)));
setMediaManifest(manifest);
const portrait = (name, short) => manifest.players.find((p) => p.player === name && p.team_short === short);
const entity = (p) => ({ id: p.player_id, season: p.season, teamId: p.team_id });

test('transferred players retain the selected team portrait', () => {
  const blg = portrait('Wei', 'BLG');
  const ig = portrait('Wei', 'IG');
  assert.notEqual(playerImageUrl(entity(blg)), playerImageUrl(entity(ig)));
  assert.ok(playerImageUrl(entity(blg)).endsWith('/player/2025/blg/wei.png'));
  assert.ok(playerImageUrl(entity(ig)).endsWith('/player/2025/ig/wei.png'));
});

test('split lookup reuses an earlier same-team photo but never a later or different-year one', () => {
  const bin = entity(portrait('Bin', 'BLG'));
  assert.equal(playerImageAsset({ ...bin, split: 'Split 2 Placements' }).source_split, 'Split 1');
  assert.equal(playerImageUrl({ ...entity(portrait('Wei', 'IG')), split: 'Split 2' }), PLAYER_IMAGE_FALLBACK);
  assert.equal(playerImageUrl({ ...bin, season: 2024 }), PLAYER_IMAGE_FALLBACK);
  assert.equal(playerImageUrl({ ...bin, split: 'Unknown split' }), PLAYER_IMAGE_FALLBACK);
});

test('missing transfer portraits do not borrow another jersey; unknown teams/years have a neutral fallback', () => {
  for (const missing of manifest.missing) assert.equal(playerImageUrl(entity(missing)), PLAYER_IMAGE_FALLBACK);
  const blg = manifest.teams.find((team) => team.team_short === 'BLG');
  assert.ok(teamLogoUrl({ id: blg.team_id, season: 2025 }).endsWith('/team/2025/blg.png'));
  assert.equal(teamLogoUrl({ id: blg.team_id, season: 2026 }), TEAM_LOGO_FALLBACK);
  assert.equal(playerImageUrl({ id: 'unknown', season: 2025 }), PLAYER_IMAGE_FALLBACK);
});

test('player links preserve team/year and older links still parse', () => {
  const wei = entity(portrait('Wei', 'BLG'));
  assert.deepEqual(parseHash(href.player(wei.id, wei.teamId, wei.season)), {
    name: 'player', id: wei.id, teamId: wei.teamId, season: '2025',
  });
  assert.deepEqual(parseHash(href.player(wei.id)), { name: 'player', id: wei.id, teamId: null, season: null });
  assert.deepEqual(parseHash('#/players/2'), { name: 'players', page: 2 });
});

test('the full-data loader keeps all 46 lineups and linked player pages in their own team', async () => {
  // Exercise the real loader with full data, without changing the UI's test default.
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url) => new Response(await readFile(
    new URL(String(url).replace('/data/test/', '/data/processed/')),
  ));
  try {
    const { dataSource } = await import('../utils/data-source.js');
    const catalog = await dataSource.loadCatalog();
    assert.equal(catalog.lineups.length, 46);
    assert.equal(catalog.players.length, 114);
    for (const lineup of catalog.lineups) {
      assert.equal(lineup.players.length, 5);
      for (const player of lineup.players) {
        assert.equal(player.teamId, lineup.teamId);
        assert.equal(player.team.id, lineup.teamId);
        assert.equal((await dataSource.getPlayer(player.id, lineup.teamId, player.season)).teamId, lineup.teamId);
      }
    }
    const available = catalog.players.filter((player) => playerImageAsset(player));
    assert.equal(available.length, 112);
    const wei = portrait('Wei', 'BLG');
    assert.equal((await dataSource.getPlayer(wei.player_id, wei.team_id, 2025)).team.short, 'BLG');
    assert.equal(await dataSource.getPlayer(wei.player_id, wei.team_id, 2024), null);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
