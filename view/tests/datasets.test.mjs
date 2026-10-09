import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import {
  leagueOptions, seasonOptions, resolveDatasetSelection, validateManifest,
  loadDatasetManifest, setDatasetSelection, getSelectedDataset,
} from '../utils/season.js';
import { createDataSource, dataSource } from '../utils/data-source.js';
import { datasetRequestForRoute, href, parseHash, routeAfterDatasetChange, routeHref } from '../utils/navigation.js';
import { championTeam, overviewItems } from '../pages/home/home-page.js';

const manifest = {
  version: 1, default: { league: 'LPL', year: 2025 }, datasets: [
    { id: 'lpl-2025', league: 'LPL', year: 2025, path: 'lpl/2025', status: 'ready' },
    { id: 'lpl-2024', league: 'LPL', year: 2024, path: 'lpl/2024', status: 'ready' },
    { id: 'lck-2023', league: 'LCK', year: 2023, path: 'lck/2023', status: 'ready', model_status: 'insufficient_history' },
    { id: 'lck-2025', league: 'LCK', year: 2025, path: 'lck/2025', status: 'unavailable', reason: 'No complete games' },
  ],
};

test('league/year choices reflect sparse recorded coverage and never synthesize a cross-product', () => {
  assert.equal(validateManifest(manifest), manifest);
  assert.deepEqual(leagueOptions(manifest), ['LCK', 'LPL']);
  assert.deepEqual(seasonOptions('LPL', manifest).map((entry) => entry.year), [2025, 2024]);
  assert.deepEqual(seasonOptions('LCK', manifest).map((entry) => [entry.year, entry.status]), [[2025, 'unavailable'], [2023, 'ready']]);
  assert.equal(resolveDatasetSelection(manifest).id, 'lpl-2025');
  assert.equal(resolveDatasetSelection(manifest, { league: 'LCK' }, manifest.default).id, 'lck-2023', 'switching leagues selects a usable year');
  assert.equal(resolveDatasetSelection(manifest, { league: 'LCK', year: 2025 }).reason, 'No complete games', 'explicit unavailable links keep their reason');
  assert.equal(resolveDatasetSelection(manifest, { league: 'LCK', year: 2024 }).id, 'lck-2023');
  assert.equal(resolveDatasetSelection(manifest, { league: 'unknown', year: 1900 }).id, 'lpl-2025');
  assert.throws(() => validateManifest({ ...manifest, datasets: [{ ...manifest.datasets[0], path: '../2025' }] }), /Invalid dataset entry/);
  assert.throws(() => validateManifest({ ...manifest, datasets: [manifest.datasets[0], manifest.datasets[0]] }), /Invalid dataset entry/);
  assert.throws(() => validateManifest({ ...manifest, datasets: [{ ...manifest.datasets[0], compression: 'zip' }] }), /Invalid dataset entry/);
});

test('a wholly unavailable manifest with no default still selects the recorded reason and accepts legacy routes', async () => {
  const unavailable = { version: 1, default: null, datasets: [manifest.datasets[3]] };
  assert.equal(validateManifest(unavailable), unavailable);
  for (const hash of ['#/', '#/player/old-id', '#/team/old-id?season=2025']) {
    const request = datasetRequestForRoute(parseHash(hash), unavailable.default);
    assert.equal(resolveDatasetSelection(unavailable, request, unavailable.default).reason, 'No complete games');
  }
  const previousFetch = globalThis.fetch;
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  globalThis.fetch = async (url) => {
    assert.ok(new URL(url).pathname.endsWith('/datasets.json'), 'initializing an unavailable selection only reads its manifest');
    return new Response(JSON.stringify(unavailable));
  };
  try {
    const fresh = await import('../utils/season.js?all-unavailable');
    const entry = await fresh.ensureDataset();
    assert.equal(entry.status, 'unavailable');
    assert.equal(entry.reason, 'No complete games');
    assert.throws(() => createDataSource(entry), /No complete games/);
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.localStorage = previousStorage;
  }
});

test('deep links carry league/year and switching datasets leaves entity IDs behind', () => {
  const entry = manifest.datasets[2];
  for (const name of ['home', 'players', 'compare', 'player', 'team', 'lineup']) {
    const route = { name, id: 'same/id', teamId: name === 'player' ? 'team-1' : null, page: 3 };
    const parsed = parseHash(routeHref(route, entry));
    assert.equal(parsed.name, name);
    assert.equal(parsed.league, 'LCK');
    assert.equal(parsed.year, '2023');
    if (['player', 'team', 'lineup'].includes(name)) assert.equal(parsed.id, 'same/id');
  }
  const legacy = parseHash('#/player/a?team=t&season=2025');
  assert.equal(legacy.season, '2025');
  assert.equal(legacy.year, '2025');
  assert.deepEqual(datasetRequestForRoute(parseHash('#/team/old-id'), manifest.default), {
    name: 'team', id: 'old-id', league: 'LPL', year: 2025,
  });
  assert.equal(datasetRequestForRoute(legacy, manifest.default).league, 'LPL');
  assert.equal(parseHash('#/player/%broken').name, 'not-found');
  for (const name of ['player', 'team', 'lineup']) {
    assert.deepEqual(routeAfterDatasetChange({ name, id: 'reused-id' }), { name: 'players', page: 1 });
  }
  assert.deepEqual(routeAfterDatasetChange({ name: 'compare' }), { name: 'compare' });
});

function affinity(league) {
  const players = ['top', 'jng', 'mid', 'bot', 'sup'].map((role) => ({ id: role, role, name: `${league} ${role}` }));
  return { version: 1, players, cells: players.flatMap((_, row) => players.map((__, col) => ({
    row, col, kind: row === col ? 'self' : 'missing', value: null, pair: null,
  }))), limit: 0.15, hasEligiblePair: false };
}

function fixtureCsv(filename, league, year) {
  if (filename === 'team_panel.csv') return `kind,team_id,team_short,team,season,player_id,player,role,split\nplayer,team,${league},${league} Team,${year},player,${league} Player,mid,Spring\n`;
  if (filename === 'players.csv') return 'player_id,team_id,role,n_games,n_games_total,eligible,mean_expected_dpm\nplayer,team,mid,0,3,false,\n';
  if (filename === 'teams.csv') return 'team_id,n_games,n_games_total,eligible\nteam,0,3,false\n';
  if (filename === 'lineups.csv') return `lineup_id,affinity_score\nshared-lineup,"${JSON.stringify(affinity(league)).replaceAll('"', '""')}"\n`;
  if (filename === 'player_games.csv') return `record_id,player_id,team_id,season,role,dpm,expected_dpm\ngame,player,team,${year},mid,500,\n`;
  throw new Error(`Unexpected file ${filename}`);
}

test('pending reads, catalogues, detail games and same-ID affinities remain isolated across selection changes', async () => {
  const previousFetch = globalThis.fetch;
  const previousStorage = globalThis.localStorage;
  const storage = new Map();
  globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const requests = [];
  let releaseSlow;
  const slow = new Promise((resolve) => { releaseSlow = resolve; });
  let startedSlow;
  const started = new Promise((resolve) => { startedSlow = resolve; });
  globalThis.fetch = async (url) => {
    const path = new URL(url).pathname;
    if (path.endsWith('/datasets.json')) return new Response(JSON.stringify(manifest));
    if (path.endsWith('/media.json')) return new Response(JSON.stringify({ schema_version: 1, teams: [], players: [] }));
    const [, league, year, filename] = /\/processed\/([^/]+)\/(\d+)\/([^/]+)$/.exec(path) ?? [];
    assert.ok(league, `all requests use a manifest dataset directory: ${path}`);
    requests.push(`${league}/${year}/${filename}`);
    if (league === 'lpl' && filename === 'team_panel.csv') { startedSlow(); await slow; }
    return new Response(fixtureCsv(filename, league.toUpperCase(), year));
  };
  try {
    await loadDatasetManifest();
    setDatasetSelection({ league: 'LPL', year: 2025 });
    const pending = dataSource.loadCatalog();
    await started;
    setDatasetSelection({ league: 'LCK', year: 2023 });
    const korea = await dataSource.loadCatalog();
    assert.equal(korea.teams[0].name, 'LCK Team');
    assert.equal(korea.players[0].league, 'LCK');
    assert.equal(korea.players[0].stats.mean_expected_dpm, null, 'unmodeled statistics remain null');
    assert.equal((await dataSource.loadPlayerGames('player'))[0].season, 2023);
    assert.equal((await dataSource.getLineupAffinity('shared-lineup')).players[0].name, 'LCK top');
    releaseSlow();
    const china = await pending;
    assert.equal(china.teams[0].name, 'LPL Team', 'an old request keeps its original source');
    assert.equal(getSelectedDataset().league, 'LCK', 'old responses do not change current selection');
    assert.equal(await dataSource.loadCatalog(), korea);
    setDatasetSelection({ league: 'LPL', year: 2025 });
    assert.equal(await dataSource.loadCatalog(), china, 'returning to a dataset reuses only its own cache');
    assert.equal((await dataSource.getLineupAffinity('shared-lineup')).players[0].name, 'LPL top');
    assert.equal((await dataSource.loadPlayerGames('player'))[0].season, 2025);
    assert.equal(await dataSource.getPlayer('player', 'team', 2023), null);
    assert.equal(await dataSource.getTeam('missing'), null);
    assert.equal(requests.filter((path) => path === 'lpl/2025/team_panel.csv').length, 1);
    assert.equal(requests.filter((path) => path === 'lck/2023/lineups.csv').length, 1);
    assert.equal(parseHash(href.team('team')).league, 'LPL');
    assert.deepEqual(JSON.parse(storage.get('stats401-dataset')), { league: 'LPL', year: 2025 });
    const refreshed = await import('../utils/season.js?persisted-selection');
    assert.equal((await refreshed.ensureDataset()).id, 'lpl-2025');
    setDatasetSelection({ league: 'LCK', year: 2025 });
    const before = requests.length;
    await assert.rejects(dataSource.loadCatalog(), /No complete games/);
    assert.equal(requests.length, before, 'unavailable datasets never request CSVs');
  } finally {
    releaseSlow();
    globalThis.fetch = previousFetch;
    globalThis.localStorage = previousStorage;
  }
});

test('failed CSV reads can be retried and no league/year falls back to legacy data', async () => {
  let attempts = 0;
  const source = createDataSource({ ...manifest.datasets[0], data_version: 'bundle-v2' }, {
    mediaLoader: async () => {},
    fetcher: async (url) => {
      assert.ok(new URL(url).pathname.endsWith('/lpl/2025/lineups.csv'));
      assert.equal(new URL(url).searchParams.get('v'), 'bundle-v2');
      attempts += 1;
      return attempts === 1 ? new Response('', { status: 503 }) : new Response(fixtureCsv('lineups.csv', 'LPL', 2025));
    },
  });
  await assert.rejects(source.getLineupAffinity('shared-lineup'), /503/);
  assert.equal((await source.getLineupAffinity('shared-lineup')).players[0].name, 'LPL top');
  assert.equal(attempts, 2);
});

test('gzip datasets fetch versioned .csv.gz files and hydrate catalogue, UTF-8 text, affinities and game details', async () => {
  const requests = [];
  let mediaReads = 0;
  const entry = { ...manifest.datasets[0], compression: 'gzip', data_version: 'compressed-v3' };
  assert.equal(validateManifest({ ...manifest, datasets: [entry] }).datasets[0], entry);
  const source = createDataSource(entry, {
    mediaLoader: async () => { mediaReads += 1; },
    fetcher: async (url) => {
      const request = new URL(url);
      assert.equal(request.searchParams.get('v'), 'compressed-v3');
      const [, filename] = /\/processed\/lpl\/2025\/([^/]+\.csv)\.gz$/.exec(request.pathname) ?? [];
      assert.ok(filename, `compressed CSV paths retain their dataset directory: ${request.pathname}`);
      requests.push(filename);
      return new Response(gzipSync(fixtureCsv(filename, '赛区', 2025)));
    },
  });
  const catalog = await source.loadCatalog();
  assert.equal(catalog.players[0].name, '赛区 Player');
  assert.equal(catalog.teams[0].name, '赛区 Team');
  assert.equal(catalog.players[0].stats.mean_expected_dpm, null);
  assert.equal((await source.getLineupAffinity('shared-lineup')).players[0].name, '赛区 top');
  const games = await source.loadPlayerGames('player');
  assert.equal(games[0].season, 2025);
  assert.equal(games[0].expected_dpm, null);
  assert.equal(await source.loadCatalog(), catalog, 'decoded CSVs retain normal source caching');
  assert.deepEqual(requests.sort(), ['lineups.csv', 'player_games.csv', 'players.csv', 'team_panel.csv', 'teams.csv']);
  assert.equal(mediaReads, 1, 'media continues through its unchanged JSON loader');
});

test('gzip failures name the file and can be retried without caching damaged content', async () => {
  let attempts = 0;
  const source = createDataSource({ ...manifest.datasets[0], compression: 'gzip', source_sha256: 'source-v1' }, {
    mediaLoader: async () => {},
    fetcher: async (url) => {
      assert.equal(new URL(url).searchParams.get('v'), 'source-v1');
      attempts += 1;
      if (attempts === 1) return new Response('', { status: 404 });
      if (attempts === 2) return new Response('truncated gzip file');
      return new Response(gzipSync(fixtureCsv('lineups.csv', 'LPL', 2025)));
    },
  });
  await assert.rejects(source.getLineupAffinity('shared-lineup'), /Failed to load lineups\.csv\.gz \(404\)/);
  await assert.rejects(source.getLineupAffinity('shared-lineup'), /Failed to decompress lineups\.csv\.gz/);
  assert.equal((await source.getLineupAffinity('shared-lineup')).players[0].name, 'LPL top');
  assert.equal(attempts, 3);
});

test('unsupported gzip browsers receive a clear error instead of parsing binary CSV', async () => {
  const previous = globalThis.DecompressionStream;
  globalThis.DecompressionStream = undefined;
  try {
    const source = createDataSource({ ...manifest.datasets[0], compression: 'gzip' }, {
      mediaLoader: async () => {},
      fetcher: async () => new Response(gzipSync(fixtureCsv('lineups.csv', 'LPL', 2025))),
    });
    await assert.rejects(source.getLineupAffinity('shared-lineup'), /lineups\.csv\.gz.*does not support gzip decompression/);
  } finally {
    globalThis.DecompressionStream = previous;
  }
});

test('a season champion requires explicit metadata rather than a name or win-rate assumption', () => {
  const teams = [{ id: 'al', sourceName: "Anyone's Legend", stats: { win_rate: 1 } }];
  assert.equal(championTeam(teams, manifest.datasets[0]), null);
  assert.equal(championTeam(teams, { ...manifest.datasets[0], champion: { team_id: 'al' } }), teams[0]);
  assert.equal(championTeam(teams, { champion: { team_id: 'not-present' } }), null);
});

test('home counts distinct players and distinguishes all games from model-evaluated games', () => {
  const items = overviewItems({
    season: 2025,
    teams: [{ stats: { n_games: 657, n_games_total: 805 } }, { stats: { n_games: 657, n_games_total: 805 } }],
    players: [{ id: 'transfer', stats: { eligible: true } }, { id: 'transfer', stats: { eligible: false } }, { id: 'other', stats: { eligible: false } }],
    lineups: [],
  }, { games: 805 });
  assert.equal(items.find(([key]) => key === 'players')[2], '2');
  assert.equal(items.find(([key]) => key === 'players')[3], '50.0% eligible');
  assert.equal(items.find(([key]) => key === 'games')[2], '805');
  assert.equal(items.find(([key]) => key === 'games')[3], '657 evaluated · 81.6%');
});
