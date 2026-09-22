import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

function fixturePayload() {
  const players = ['top', 'jng', 'mid', 'bot', 'sup'].map((role, index) => ({
    id: `player-${index}`, name: `Player ${index}`, role,
  }));
  const pair = {
    id: 'pair-0-1', teamId: 'team', teamName: 'Team',
    playerAId: players[0].id, playerBId: players[1].id,
    playerA: players[0].name, playerB: players[1].name,
    stats: {
      eligible: true, n_games_total: 15, n_games: 12, n_days: 4,
      mean_impact: 0.4, shrunk_impact: 0.21818182, ci_low: 0.1, ci_high: 0.3, win_rate: 0.5,
    },
  };
  return {
    version: 1,
    players,
    cells: players.flatMap((_, row) => players.map((__, col) => ({
      row, col,
      kind: row === col ? 'self' : row + col === 1 ? 'eligible' : 'missing',
      value: row + col === 1 ? pair.stats.shrunk_impact : null,
      pair: row + col === 1 ? pair : null,
    }))),
    limit: pair.stats.shrunk_impact,
    hasEligiblePair: true,
  };
}

function affinityCsv(value) {
  return `lineup_id,affinity_score\nlineup-1,"${value.replaceAll('"', '""')}"\n`;
}

test('lineup drawer context loads only affinity_score, preserves payload, and shares its CSV cache', async () => {
  const previousFetch = globalThis.fetch;
  const payload = fixturePayload();
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(new URL(url).pathname.split('/').pop());
    assert.equal(requests.at(-1), 'lineups.csv', 'lineup heatmap must not fetch other inputs');
    return new Response(affinityCsv(JSON.stringify(payload)));
  };
  try {
    const { loadLineupHeatmap } = await import('../features/pair-impact/pair-impact-data.js');
    const { dataSource } = await import('../utils/data-source.js');
    const [heatmap, cached] = await Promise.all([
      loadLineupHeatmap('lineup-1'),
      dataSource.getLineupAffinity('lineup-1'),
    ]);
    assert.equal(heatmap, cached);
    assert.deepEqual(heatmap, payload);
    assert.equal(await dataSource.getLineupAffinity('lineup-1'), cached);
    assert.equal(await dataSource.getLineupAffinity('unknown-lineup'), null);
    assert.deepEqual(requests, ['lineups.csv']);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('catalogue and lineup affinity reuse lineups.csv; pair APIs lazily load pairs.csv once', async () => {
  const previousFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    const filename = new URL(url).pathname.split('/').pop();
    requests.push(filename);
    return new Response(filename === 'lineups.csv'
      ? affinityCsv(JSON.stringify(fixturePayload()))
      : await readFile(url));
  };
  try {
    const { dataSource } = await import('../utils/data-source.js?affinity-loader-lazy');
    const catalog = await dataSource.loadCatalog();
    assert.ok(catalog.teams.length);
    assert.ok(!requests.includes('pairs.csv'));
    assert.ok(!requests.includes('player_games.csv'));
    assert.deepEqual(await dataSource.getLineupAffinity('lineup-1'), fixturePayload());
    assert.equal(requests.filter((name) => name === 'lineups.csv').length, 1);
    const teamId = catalog.teams[0].id;
    const teamPairs = await dataSource.listTeamPairs(teamId);
    assert.ok(teamPairs.length);
    const first = teamPairs[0];
    const playerPairs = await dataSource.listPairsForPlayer(first.playerAId, teamId);
    assert.ok(playerPairs.some((pair) => pair.id === first.id));
    assert.deepEqual(await dataSource.listPairsForPlayers([first.playerAId, first.playerBId], teamId), [first]);
    assert.equal(requests.filter((name) => name === 'pairs.csv').length, 1);
    assert.ok(!requests.includes('player_games.csv'));
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('missing, scalar, malformed, and unsupported affinity payloads fail without computing a replacement', async () => {
  const previousFetch = globalThis.fetch;
  const invalid = ['', '0.12', '{broken', JSON.stringify({ ...fixturePayload(), version: 2 }),
    JSON.stringify({ ...fixturePayload(), cells: [] })];
  try {
    for (const [index, value] of invalid.entries()) {
      const requests = [];
      globalThis.fetch = async (url) => {
        requests.push(new URL(url).pathname.split('/').pop());
        return new Response(affinityCsv(value));
      };
      const { dataSource } = await import(`../utils/data-source.js?affinity-loader-invalid=${index}`);
      await assert.rejects(dataSource.getLineupAffinity('lineup-1'), /Invalid affinity_score/);
      assert.deepEqual(requests, ['lineups.csv']);
    }
  } finally {
    globalThis.fetch = previousFetch;
  }
});
