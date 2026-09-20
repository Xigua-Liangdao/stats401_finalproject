import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  baselineValue, createRadarAxes, minimumRadarSpan, profileSegments, profileValues, radiusFor,
  timelineGamesForPlayer,
} from '../features/player/player-baseline.js';
import { findCategory, formatChartValue, SERIES_META } from '../features/player/player-chart-config.js';
import { parseCsv } from '../utils/csv.js';

const stats = {
  n_games: 12,
  mean_gold_share: 0.24, mean_damage_share: 0.32, mean_dpm: 720,
  mean_expected_dpm: 680, mean_vision_per_minute: 1.2, shrunk_impact: 0.15,
  mean_baseline_gold_share: 0.2, mean_baseline_damage_share: 0.25,
  mean_baseline_dpm: 600, mean_baseline_vision_per_minute: 0.8, mean_baseline_impact: 0.07,
};

test('every radar baseline axis is independent from actual and context-expected values', () => {
  const axes = createRadarAxes([{ stats }]);
  assert.deepEqual(profileValues(stats, axes), [0.24, 0.32, 720, 1.2, 0.15]);
  assert.deepEqual(profileValues(stats, axes, true), [0.2, 0.25, 600, 0.8, 0.07]);
  assert.notEqual(baselineValue(stats, 'mean_dpm'), stats.mean_expected_dpm);
});

test('missing season statistics remain missing and warmup-only players can use the season role baseline', () => {
  const axes = createRadarAxes();
  assert.deepEqual(profileValues({}, axes, true), [null, null, null, null, null]);
  assert.deepEqual(profileValues({ n_games: 2, mean_expected_dpm: 900 }, axes, true), [null, null, null, null, null]);
  assert.deepEqual(profileValues({ ...stats, n_games: 0 }, axes, true), [0.2, 0.25, 600, 0.8, 0.07]);
  for (const n_games of [undefined, null, NaN, 0, -1]) {
    assert.equal(baselineValue({ n_games }, 'shrunk_impact'), null);
  }
  for (const invalid of [null, undefined, '', '5', NaN, Infinity]) {
    assert.equal(baselineValue({ mean_baseline_dpm: invalid }, 'mean_dpm'), null);
  }
  assert.equal(baselineValue({ mean_baseline_dpm: 0 }, 'mean_dpm'), 0);
  assert.equal(baselineValue({ mean_baseline_impact: 0 }, 'shrunk_impact'), 0);
  assert.equal(radiusFor(axes[2], null), null);
});

test('full scales include season role means and nonzero impact even beyond all actual values', () => {
  const axes = createRadarAxes([{ stats: {
    ...stats, mean_baseline_dpm: 950, mean_baseline_vision_per_minute: 4, mean_baseline_impact: 0.7,
  } }]);
  assert.equal(axes[2].max, 950);
  assert.equal(axes[3].max, 4);
  assert.equal(axes[4].min, 0);
  assert.equal(axes[4].max, 0.7);
  assert.equal(radiusFor(axes[2], 950), 1);
  const negativeImpact = createRadarAxes([{ stats: { ...stats, shrunk_impact: -0.4 } }])[4];
  assert.equal(negativeImpact.min, -0.4);
  assert.equal(negativeImpact.max, 0.07);
  assert.equal(radiusFor(negativeImpact, baselineValue(stats, 'shrunk_impact')), 1);
});

test('zoom bound includes each visible baseline axis without changing the actual profile', () => {
  const fieldPairs = [
    ['mean_gold_share', 'mean_baseline_gold_share'],
    ['mean_damage_share', 'mean_baseline_damage_share'],
    ['mean_dpm', 'mean_baseline_dpm'],
    ['mean_vision_per_minute', 'mean_baseline_vision_per_minute'],
    ['shrunk_impact', 'mean_baseline_impact'],
  ];
  for (const [key, field] of fieldPairs) {
    const axes = [{ key, min: 0, max: 1 }];
    const values = { [key]: 0.2, [field]: 0.75 };
    assert.equal(minimumRadarSpan(values, axes, false), 0.25);
    assert.equal(minimumRadarSpan(values, axes, true), 0.8);
    assert.ok(radiusFor(axes[0], values[field], minimumRadarSpan(values, axes, true)) < 1);
  }
  const axes = [{ key: 'shrunk_impact', min: -1, max: 1 }];
  assert.equal(minimumRadarSpan({ shrunk_impact: -0.8, n_games: 1 }, axes, false), 0.25);
  assert.equal(minimumRadarSpan({ shrunk_impact: -0.8, mean_baseline_impact: 0.2 }, axes, true), 0.65);
});

test('timeline uses the fixed season role DPM across transfers and warmup without changing model training means', () => {
  const player = { season: 2025, role: 'mid', teamId: 'B', stats };
  const games = [
    { id: 'warmup', season: 2025, role: 'mid', teamId: 'A', baseline_dpm: null },
    { id: 'modeled', season: '2025', role: 'mid', teamId: 'B', baseline_dpm: 550 },
    { id: 'role-change', season: 2025, role: 'top', teamId: 'B', baseline_dpm: 400 },
    { id: 'old-season', season: 2024, role: 'mid', teamId: 'A', baseline_dpm: 500 },
  ];
  const prepared = timelineGamesForPlayer(player, games);
  assert.deepEqual(prepared.map((game) => game.id), ['warmup', 'modeled']);
  assert.deepEqual(prepared.map((game) => game.season_role_baseline_dpm), [600, 600]);
  assert.deepEqual(prepared.map((game) => game.baseline_dpm), [null, 550]);
  assert.ok(games.every((game) => !Object.hasOwn(game, 'season_role_baseline_dpm')));
  assert.equal(timelineGamesForPlayer({ ...player, stats: {} }, games)[0].season_role_baseline_dpm, null);
  assert.equal(timelineGamesForPlayer({ team: { season: 2025 }, role: 'mid', stats }, [{ season: 2025 }]).length, 1);
});

test('DPM controls and tooltips distinguish the descriptive season baseline from the training mean', () => {
  const dpm = findCategory('dpm');
  assert.ok(dpm.metrics.some((metric) => metric.field === 'season_role_baseline_dpm'));
  assert.equal(SERIES_META.season_role_baseline_dpm.label, 'Season role baseline DPM');
  assert.equal(SERIES_META.baseline_dpm.label, 'Training role mean DPM');
  assert.equal(formatChartValue('season_role_baseline_dpm', 612.345), '612.35');
});

test('a complete profile closes, including a genuine zero measurement', () => {
  assert.deepEqual(profileSegments([0, 0.2, 0.4, 0.6, 0.8]), [{
    closed: true,
    points: [0, 0.2, 0.4, 0.6, 0.8].map((value, index) => ({ index, value })),
  }]);
});

test('gaps produce open segments with no invented zero, connecting only adjacent circular axes', () => {
  assert.deepEqual(profileSegments([0.1, null, 0.3, 0.4, 0.5]), [{
    closed: false,
    points: [{ index: 2, value: 0.3 }, { index: 3, value: 0.4 }, { index: 4, value: 0.5 }, { index: 0, value: 0.1 }],
  }]);
  assert.deepEqual(profileSegments([0.1, null, 0.3, NaN, 0.5]), [
    { closed: false, points: [{ index: 2, value: 0.3 }] },
    { closed: false, points: [{ index: 4, value: 0.5 }, { index: 0, value: 0.1 }] },
  ]);
  assert.deepEqual(profileSegments([null, undefined, NaN]), []);
  assert.deepEqual(profileSegments([]), []);
});

test('real catalog loader preserves baseline fields in both generated datasets', async () => {
  const previousFetch = globalThis.fetch;
  const datasetReferences = new Map();
  try {
    for (const dataset of ['test', 'processed']) {
      globalThis.fetch = async (url) => new Response(await readFile(
        new URL(String(url).replace('/data/test/', `/data/${dataset}/`)),
      ));
      const csvRows = parseCsv(await readFile(new URL(`../../data/${dataset}/players.csv`, import.meta.url), 'utf8'));
      const byPlayer = new Map(csvRows.map((row) => [`${row.season}|${row.player_id}|${row.team_id}|${row.role}`, row]));
      const { dataSource } = await import(`../utils/data-source.js?baseline-test=${dataset}`);
      const catalog = await dataSource.loadCatalog();
      const fields = [
        'mean_baseline_gold_share', 'mean_baseline_damage_share',
        'mean_baseline_dpm', 'mean_baseline_vision_per_minute', 'mean_baseline_impact',
      ];
      assert.ok(catalog.players.some((player) => player.stats.n_games > 0));
      for (const field of fields) {
        assert.ok(catalog.players.some((player) => Number.isFinite(player.stats[field])), `${dataset}: ${field} populated`);
      }
      for (const player of catalog.players) {
        const row = byPlayer.get(`${player.season}|${player.id}|${player.teamId}|${player.role}`);
        for (const field of fields) {
          assert.ok(Object.hasOwn(row, field), `${dataset}: CSV exports ${field}`);
          assert.equal(player.stats[field], row[field] === '' ? null : Number(row[field]));
        }
        assert.equal(baselineValue(player.stats, 'shrunk_impact'), player.stats.mean_baseline_impact);
      }
      const roleReferences = new Map();
      for (const player of catalog.players) {
        const key = `${player.season}|${player.role}`;
        const reference = fields.map((field) => player.stats[field]);
        if (roleReferences.has(key)) assert.deepEqual(reference, roleReferences.get(key), `${dataset}: shared season role reference`);
        roleReferences.set(key, reference);
      }
      datasetReferences.set(dataset, roleReferences);
      assert.ok(catalog.players.some((player) => Number.isFinite(player.stats.mean_baseline_impact)
        && player.stats.mean_baseline_impact !== 0));
      const warmupOnly = catalog.players.filter((player) => player.stats.n_games === 0);
      for (const player of warmupOnly) {
        assert.ok(profileValues(player.stats, createRadarAxes(), true).every(Number.isFinite));
      }
      const selected = catalog.players[0];
      const rawGames = parseCsv(await readFile(new URL(`../../data/${dataset}/player_games.csv`, import.meta.url), 'utf8'));
      const gamesById = new Map(rawGames.map((row) => [row.record_id, row]));
      const games = await dataSource.loadPlayerGames(selected.id);
      for (const game of games) assert.equal(game.role, gamesById.get(game.id).role);
      for (const game of timelineGamesForPlayer(selected, games)) {
        assert.equal(game.season_role_baseline_dpm, selected.stats.mean_baseline_dpm);
      }
    }
    for (const [key, reference] of datasetReferences.get('test')) {
      assert.deepEqual(reference, datasetReferences.get('processed').get(key), 'test fixture retains full-season role baseline');
    }
  } finally {
    globalThis.fetch = previousFetch;
  }
});
