import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  baselineValue, createRadarAxes, minimumRadarSpan, profileSegments, profileValues, radiusFor,
} from '../features/player/player-baseline.js';
import { parseCsv } from '../utils/csv.js';

const stats = {
  n_games: 12,
  mean_gold_share: 0.24, mean_damage_share: 0.32, mean_dpm: 720,
  mean_expected_dpm: 680, mean_vision_per_minute: 1.2, shrunk_impact: 0.15,
  mean_baseline_gold_share: 0.2, mean_baseline_damage_share: 0.25,
  mean_baseline_dpm: 600, mean_baseline_vision_per_minute: 0.8,
};

test('every radar baseline axis is independent from actual and context-expected values', () => {
  const axes = createRadarAxes([{ stats }]);
  assert.deepEqual(profileValues(stats, axes), [0.24, 0.32, 720, 1.2, 0.15]);
  assert.deepEqual(profileValues(stats, axes, true), [0.2, 0.25, 600, 0.8, 0]);
  assert.notEqual(baselineValue(stats, 'mean_dpm'), stats.mean_expected_dpm);
});

test('missing historical statistics remain missing; impact zero requires evaluated games', () => {
  const axes = createRadarAxes();
  assert.deepEqual(profileValues({}, axes, true), [null, null, null, null, null]);
  assert.deepEqual(profileValues({ n_games: 2, mean_expected_dpm: 900 }, axes, true), [null, null, null, null, 0]);
  for (const n_games of [undefined, null, NaN, 0, -1]) {
    assert.equal(baselineValue({ n_games }, 'shrunk_impact'), null);
  }
  for (const invalid of [null, undefined, '', '5', NaN, Infinity]) {
    assert.equal(baselineValue({ mean_baseline_dpm: invalid }, 'mean_dpm'), null);
  }
  assert.equal(baselineValue({ mean_baseline_dpm: 0 }, 'mean_dpm'), 0);
  assert.equal(radiusFor(axes[2], null), null);
});

test('full scales include historical means and zero impact even beyond all actual values', () => {
  const axes = createRadarAxes([{ stats: {
    ...stats, mean_baseline_dpm: 950, mean_baseline_vision_per_minute: 4,
  } }]);
  assert.equal(axes[2].max, 950);
  assert.equal(axes[3].max, 4);
  assert.equal(axes[4].min, 0);
  assert.equal(radiusFor(axes[2], 950), 1);
  const negativeImpact = createRadarAxes([{ stats: { ...stats, shrunk_impact: -0.4 } }])[4];
  assert.equal(negativeImpact.min, -0.4);
  assert.equal(negativeImpact.max, 0);
  assert.equal(radiusFor(negativeImpact, baselineValue(stats, 'shrunk_impact')), 1);
});

test('zoom bound includes each visible baseline axis without changing the actual profile', () => {
  const fieldPairs = [
    ['mean_gold_share', 'mean_baseline_gold_share'],
    ['mean_damage_share', 'mean_baseline_damage_share'],
    ['mean_dpm', 'mean_baseline_dpm'],
    ['mean_vision_per_minute', 'mean_baseline_vision_per_minute'],
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
  assert.equal(minimumRadarSpan({ shrunk_impact: -0.8, n_games: 1 }, axes, true), 0.55);
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
  try {
    for (const dataset of ['test', 'processed']) {
      globalThis.fetch = async (url) => new Response(await readFile(
        new URL(String(url).replace('/data/test/', `/data/${dataset}/`)),
      ));
      const csvRows = parseCsv(await readFile(new URL(`../../data/${dataset}/players.csv`, import.meta.url), 'utf8'));
      const byPlayer = new Map(csvRows.map((row) => [`${row.player_id}|${row.team_id}|${row.role}`, row]));
      const { dataSource } = await import(`../utils/data-source.js?baseline-test=${dataset}`);
      const catalog = await dataSource.loadCatalog();
      const fields = [
        'mean_baseline_gold_share', 'mean_baseline_damage_share',
        'mean_baseline_dpm', 'mean_baseline_vision_per_minute',
      ];
      assert.ok(catalog.players.some((player) => player.stats.n_games > 0));
      for (const field of fields) {
        assert.ok(catalog.players.some((player) => Number.isFinite(player.stats[field])), `${dataset}: ${field} populated`);
      }
      for (const player of catalog.players) {
        const row = byPlayer.get(`${player.id}|${player.teamId}|${player.role}`);
        for (const field of fields) {
          assert.ok(Object.hasOwn(row, field), `${dataset}: CSV exports ${field}`);
          assert.equal(player.stats[field], row[field] === '' ? null : Number(row[field]));
        }
        assert.equal(baselineValue(player.stats, 'shrunk_impact'), player.stats.n_games > 0 ? 0 : null);
      }
    }
  } finally {
    globalThis.fetch = previousFetch;
  }
});
