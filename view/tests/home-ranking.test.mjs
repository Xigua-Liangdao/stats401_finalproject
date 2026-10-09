import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RANKING_ROLES, hasRankingSample, rankPlayersByRole, rankTeamsByDamage } from '../pages/home/home-ranking.js';
import { championTeam, createRoleLeaders, renderHomePage } from '../pages/home/home-page.js';
import { createDataSource, dataSource } from '../utils/data-source.js';

function entry(id, overrides = {}) {
  const { stats, ...rest } = overrides;
  return { id, name: id, sourceName: id, role: 'top', season: 2025, league: 'LPL',
    teamId: 'team-a', team: { name: 'Team A' }, ...rest,
    stats: { eligible: true, n_games: 20, n_days: 5, shrunk_impact: 0.2, win_rate: 0.5, ...stats } };
}

test('damage ranking does not promote one-game perfect records or use win rate', () => {
  const highWin = entry('high-win', { stats: { win_rate: 1, shrunk_impact: 0.1 } });
  const higherDamage = entry('higher-damage', { stats: { win_rate: 0.3, shrunk_impact: 0.6 } });
  const oneGame = entry('one-game', { stats: { win_rate: 1, shrunk_impact: 8, n_games: 1, n_days: 1 } });
  const withheld = entry('withheld', { stats: { shrunk_impact: 9, eligible: false } });
  const rows = [oneGame, highWin, withheld, higherDamage];
  assert.deepEqual(rankTeamsByDamage(rows), [higherDamage, highWin]);
  assert.deepEqual(rows, [oneGame, highWin, withheld, higherDamage], 'catalogue order is not mutated');
});

test('rankings exclude absent or nonfinite scores and enforce both sample thresholds', () => {
  for (const value of [null, undefined, '', '0.4', NaN, Infinity, -Infinity]) {
    assert.equal(hasRankingSample(entry('missing', { stats: { shrunk_impact: value } })), false);
  }
  for (const stats of [{ n_games: 9 }, { n_days: 2 }, { n_games: null }, { n_days: null }, { eligible: 'true' }]) {
    assert.equal(hasRankingSample(entry('small', { stats })), false);
  }
  const zero = entry('zero', { stats: { shrunk_impact: 0, n_games: 10, n_days: 3 } });
  const negative = entry('negative', { stats: { shrunk_impact: -0.3 } });
  assert.deepEqual(rankTeamsByDamage([negative, zero]), [zero, negative], 'genuine zero and negative scores stay usable');
});

test('equal damage favors games and days, with a locale-independent final tie', () => {
  const a = entry('a', { name: 'ZZZ', stats: { win_rate: 0 } });
  const b = entry('b', { name: 'AAA', stats: { win_rate: 1 } });
  const moreDays = entry('days', { stats: { n_days: 6 } });
  const moreGames = entry('games', { stats: { n_games: 30, n_days: 3 } });
  assert.deepEqual(rankTeamsByDamage([b, a, moreDays, moreGames]), [moreGames, moreDays, a, b]);
  a.name = '阿'; b.name = '波';
  assert.deepEqual(rankTeamsByDamage([b, a]), [a, b]);
});

test('players compete only within a requested role and transferred team stints stay separate', () => {
  const topA = entry('transfer', { teamId: 'a', stats: { shrunk_impact: 0.4 } });
  const topB = entry('transfer', { teamId: 'b', stats: { shrunk_impact: 0.8 } });
  const mid = entry('mid', { role: 'mid', stats: { shrunk_impact: 10 } });
  const players = [topA, mid, topB];
  assert.deepEqual(rankPlayersByRole(players, 'top'), [topB, topA]);
  assert.deepEqual(rankPlayersByRole(players, 'mid'), [mid]);
  assert.deepEqual(rankPlayersByRole(players, 'sup'), []);
  assert.deepEqual(rankPlayersByRole(players), [], 'there is no cross-role best-player fallback');
  assert.deepEqual(rankPlayersByRole(players, 'all'), []);
});

test('champion metadata is explicit and an authoritative ID cannot fall back to another name', () => {
  const team = entry('real-id', { sourceName: 'Explicit Team' });
  assert.equal(championTeam([team], {}), null);
  assert.equal(championTeam([team], { champion: 'Explicit Team' }), team);
  assert.equal(championTeam([team], { champion: { team_id: 'real-id' } }), team);
  assert.equal(championTeam([team], { champion: { team_id: 'wrong-id', name: 'Explicit Team' } }), null);
});

class Element {
  constructor(tag, text = '') { this.tag = tag; this.nodeType = tag === '#text' ? 3 : 1; this.text = text;
    this.childNodes = []; this.attributes = {}; this.dataset = {}; this.listeners = {}; this.className = ''; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  append(...children) { this.childNodes.push(...children); }
  replaceChildren(...children) { this.childNodes = children; }
  get textContent() { return this.text + this.childNodes.map((node) => node.textContent).join(' '); }
}
const descendants = (node) => [node, ...node.childNodes.flatMap(descendants)];
const fakeDocument = { createElement: (tag) => new Element(tag), createElementNS: (_, tag) => new Element(tag),
  createTextNode: (text) => new Element('#text', text) };

test('the role picker replaces the leader and announces an empty role without borrowing another role', () => {
  const previous = globalThis.document;
  globalThis.document = fakeDocument;
  try {
    const section = createRoleLeaders([entry('Top Leader'), entry('Mid Leader', { role: 'mid' })]);
    const select = descendants(section).find((node) => node.tag === 'select');
    const live = descendants(section).find((node) => node.attributes['aria-live'] === 'polite');
    assert.deepEqual(select.childNodes.map((option) => option.attributes.value), RANKING_ROLES);
    assert.match(live.textContent, /Top Leader/);
    assert.doesNotMatch(live.textContent, /Mid Leader/);
    select.value = 'mid'; select.listeners.change();
    assert.match(live.textContent, /Mid Leader/);
    assert.doesNotMatch(live.textContent, /Top Leader/);
    select.value = 'sup'; select.listeners.change();
    assert.match(live.textContent, /No SUP player/);
    assert.match(live.textContent, /10 evaluated games across 3 match days/);
    assert.ok(!descendants(live).some((node) => node.tag === 'article'));
  } finally { globalThis.document = previous; }
});

test('a warmup-only homepage shows both ranking empty states and no invented champion', async () => {
  const previousDocument = globalThis.document;
  const previousLoad = dataSource.loadCatalog;
  globalThis.document = fakeDocument;
  const stats = { eligible: false, n_games: 0, n_games_total: 1, n_days: 0, shrunk_impact: null, win_rate: null };
  dataSource.loadCatalog = async () => ({ dataset: { league: 'LPL', year: 2025, games: 1 },
    teams: [entry('team', { stats })], players: [entry('warmup', { teamId: 'team', stats })], lineups: [] });
  try {
    const target = new Element('main');
    await renderHomePage(target);
    assert.match(target.textContent, /Champion information is not provided/);
    assert.match(target.textContent, /No team meets the sample requirement/);
    assert.match(target.textContent, /No TOP player/);
    assert.equal(descendants(target).filter((node) => node.className === 'empty-state').length, 2);
    assert.equal(descendants(target).filter((node) => node.className === 'home-team').length, 0);
  } finally { globalThis.document = previousDocument; dataSource.loadCatalog = previousLoad; }
});

test('real LPL summaries supply score-ranked eligible teams and an independent leader for every role', async () => {
  const source = createDataSource({ league: 'LPL', year: 2025, path: 'lpl/2025', status: 'ready' }, {
    mediaLoader: async () => {}, fetcher: async (url) => new Response(await readFile(new URL(url))),
  });
  const catalog = await source.loadCatalog();
  const teams = rankTeamsByDamage(catalog.teams);
  assert.ok(teams.length >= 6);
  assert.ok(teams.every(hasRankingSample));
  assert.ok(teams.every((team, index) => index === 0 || team.stats.shrunk_impact <= teams[index - 1].stats.shrunk_impact));
  for (const role of RANKING_ROLES) {
    const ranked = rankPlayersByRole(catalog.players, role);
    assert.ok(ranked.length > 0, role);
    assert.ok(ranked.every((player) => player.role === role && hasRankingSample(player)));
    assert.equal(ranked[0].stats.shrunk_impact, Math.max(...ranked.map((player) => player.stats.shrunk_impact)));
  }
});
