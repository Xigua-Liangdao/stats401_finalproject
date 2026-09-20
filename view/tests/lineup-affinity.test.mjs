import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCsv } from '../utils/csv.js';

const roles = ['top', 'jng', 'mid', 'bot', 'sup'];
const pairFields = ['n_games_total', 'n_games', 'n_days', 'mean_impact', 'shrunk_impact',
  'ci_low', 'ci_high', 'win_rate'];

// Reference behavior from main a9f68b4: the original data-source, buildRoster,
// cellState and mountPairHeatmap. Keep this independent of the Python exporter
// and of the new frontend reader, so every generated result has a parity check.
function originalHeatmap(lineup, panel, pairRows) {
  function number(value) {
    if (value == null || value === '') return null;
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }
  const teamPlayers = panel.filter((row) => row.kind === 'player' && row.team_id === lineup.team_id)
    .map((row) => ({ id: row.player_id, name: row.player, role: row.role }))
    .sort((a, b) => roles.indexOf(a.role) - roles.indexOf(b.role));
  const byId = Object.fromEntries(teamPlayers.map((player) => [player.id, player]));
  const players = roles.map((role) => byId[lineup[`${role}_id`]] ?? {
    id: lineup[`${role}_id`], name: lineup[`${role}_player`], role: null,
  });
  const ids = new Set(players.map((player) => player.id));
  const pairs = pairRows.filter((row) => row.team_id === lineup.team_id
    && ids.has(row.player_a_id) && ids.has(row.player_b_id)).map((row) => ({
    id: row.pair_id, teamId: row.team_id, teamName: row.team,
    playerAId: row.player_a_id, playerBId: row.player_b_id,
    playerA: row.player_a, playerB: row.player_b,
    stats: { eligible: String(row.eligible).toLowerCase() === 'true',
      ...Object.fromEntries(pairFields.map((field) => [field, number(row[field])])) },
  })).sort((a, b) => (b.stats.n_games ?? -1) - (a.stats.n_games ?? -1) || a.id.localeCompare(b.id));
  function pairKey(a, b) { return a < b ? `${a}|${b}` : `${b}|${a}`; }
  const pairMap = new Map(pairs.map((pair) => [pairKey(pair.playerAId, pair.playerBId), pair]));
  function cellState(rowPlayer, colPlayer) {
    if (rowPlayer.id === colPlayer.id) return { kind: 'self', pair: null, value: null };
    const pair = pairMap.get(pairKey(rowPlayer.id, colPlayer.id)) ?? null;
    if (!pair) return { kind: 'missing', pair: null, value: null };
    const value = pair.stats?.shrunk_impact;
    if (value != null && Number.isFinite(value)) {
      return { kind: pair.stats?.eligible ? 'eligible' : 'sparse', pair, value };
    }
    return { kind: 'missing', pair, value: null };
  }
  const cells = players.flatMap((a, row) => players.map((b, col) => ({ row, col, ...cellState(a, b) })));
  const scoredValues = cells.filter((cell) => cell.value != null && Number.isFinite(cell.value))
    .map((cell) => Math.abs(cell.value));
  return { version: 1, players, cells,
    limit: Math.max(0.15, scoredValues.length ? Math.max(...scoredValues) : 0.15),
    hasEligiblePair: pairs.some((pair) => pair.stats?.eligible) };
}

for (const dataset of ['processed', 'test']) {
  test(`${dataset}: every stored lineup heatmap exactly matches the original frontend computation`, async () => {
    const readCsv = async (name) => parseCsv(await readFile(new URL(`../../data/${dataset}/${name}.csv`, import.meta.url), 'utf8'));
    const [lineups, panel, pairs] = await Promise.all(['lineups', 'team_panel', 'pairs'].map(readCsv));
    assert.ok(lineups.length > 0);
    assert.equal(Object.keys(lineups[0]).at(-1), 'affinity_score');
    const kinds = new Set();
    for (const lineup of lineups) {
      const stored = JSON.parse(lineup.affinity_score);
      assert.deepEqual(stored, originalHeatmap(lineup, panel, pairs), `${dataset}/${lineup.lineup_id}`);
      for (const cell of stored.cells) kinds.add(cell.kind);
    }
    // Real datasets cover scored, sparse and warmup-only states, not just a
    // happy-path fixture. All 25 cells include symmetric pair detail records.
    assert.deepEqual([...kinds].sort(), ['eligible', 'missing', 'self', 'sparse']);
  });
}
