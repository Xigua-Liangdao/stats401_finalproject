import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHash, routeHref, routeAfterDatasetChange, updateRouteState, startRouter, backAction } from '../utils/navigation.js';
import { resolveComparisonState } from '../features/comparison/comparison-state.js';

const selection = { league: 'LPL', year: '2025' };
const context = {
  teams: [{ id: 'BLG' }, { id: 'LNG' }],
  playersByTeam: new Map([
    ['BLG', [{ id: 'Bin', role: 'top' }, { id: 'Knight', role: 'mid' }]],
    ['LNG', [{ id: 'Zika', role: 'top' }, { id: 'Bin', role: 'top' }]],
  ]),
  lineupsByTeam: new Map([['BLG', [{ id: 'five/a' }]], ['LNG', [{ id: 'five b' }]]]),
};

test('comparison share links restore mode, both teams and IDs including reserved characters', () => {
  const state = { name: 'compare', mode: 'lineup', leftTeamId: 'BLG', rightTeamId: 'LNG', leftId: 'five/a', rightId: 'five b', ...selection };
  assert.deepEqual(parseHash(routeHref(state, selection)), state);
  const restored = resolveComparisonState(parseHash(routeHref(state, selection)), context);
  assert.equal(restored.leftId, 'five/a');
  assert.equal(restored.rightId, 'five b');
  assert.equal(restored.mode, 'lineup');
});

test('invalid comparison links retain valid partial choices and never compare different roles or duplicate players', () => {
  const state = { leftTeamId: 'BLG', rightTeamId: 'LNG', leftId: 'Bin', rightId: 'Zika' };
  assert.equal(resolveComparisonState(state, context).rightId, 'Zika');
  assert.equal(resolveComparisonState({ ...state, leftId: 'Knight' }, context).rightId, '');
  assert.equal(resolveComparisonState({ ...state, rightId: 'Bin' }, context).rightId, '');
  const missing = resolveComparisonState({ ...state, rightTeamId: 'removed' }, context);
  assert.equal(missing.rightTeamId, '');
  assert.equal(missing.rightId, '');
  assert.equal(missing.leftId, 'Bin');
  assert.equal(resolveComparisonState({ ...state, leftId: 'not-on-team' }, context).rightId, 'Zika');
});

test('catalogue search and filtered page survive URL round trips', () => {
  const state = { name: 'players', page: 3, query: 'BLG / 骑士 & 上单', ...selection };
  assert.deepEqual(parseHash(routeHref(state, selection)), state);
  assert.ok(!routeHref({ ...state, page: 1, query: '' }, selection).includes('q='));
});

test('match-table filters persist while invalid enum/default values are removed', () => {
  const state = { name: 'player', id: 'oe:player/a', teamId: 'BLG', season: '2025', gamePage: 3,
    dateOrder: 'asc', split: 'Split 2 Placements', patch: '15.16', result: 'win', ...selection };
  assert.deepEqual(parseHash(routeHref(state, selection)), state);
  const lineup = { ...state, name: 'lineup', id: 'five/a' };
  delete lineup.teamId; delete lineup.season;
  assert.deepEqual(parseHash(routeHref(lineup, selection)), lineup);
  const invalid = parseHash('#/lineup/a?gamePage=-1&order=bad&result=bad&league=LPL&year=2025');
  assert.deepEqual(invalid, { name: 'lineup', id: 'a', ...selection });
});

test('switching datasets clears objects and local filters instead of reusing IDs', () => {
  assert.deepEqual(routeAfterDatasetChange({ name: 'compare', leftId: 'Bin', mode: 'lineup' }), { name: 'compare' });
  assert.deepEqual(routeAfterDatasetChange({ name: 'players', query: 'BLG', page: 3 }), { name: 'players', page: 1 });
  assert.deepEqual(routeAfterDatasetChange({ name: 'player', id: 'Bin', split: 'Split 3' }), { name: 'players', page: 1 });
});

function browserFixture(hash, run) {
  const before = { window: globalThis.window, history: globalThis.history, sessionStorage: globalThis.sessionStorage };
  const store = new Map();
  const listeners = new Map();
  globalThis.window = { location: new URL(`http://localhost/view/${hash}`),
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: (name) => listeners.delete(name) };
  globalThis.history = { state: { existing: true }, replaceState(state, _, url) {
    this.state = state;
    window.location = new URL(url, window.location);
  } };
  globalThis.sessionStorage = { getItem: (key) => store.get(key), setItem: (key, value) => store.set(key, value) };
  try { run(listeners); } finally { Object.assign(globalThis, before); }
}

test('in-place updates use the latest URL and late renders cannot overwrite another page', () => {
  browserFixture('#/compare?league=LPL&year=2025', () => {
    const route = parseHash();
    updateRouteState({ leftTeamId: 'BLG', leftId: 'Bin' }, route);
    updateRouteState({ rightTeamId: 'LNG', rightId: 'Zika' }, route);
    const restored = parseHash();
    assert.equal(restored.leftId, 'Bin');
    assert.equal(restored.rightId, 'Zika');
    assert.deepEqual(history.state, { existing: true });
    window.location.hash = '#/players?league=LPL&year=2025';
    updateRouteState({ leftId: 'stale' }, route);
    assert.deepEqual(parseHash(), { name: 'players', page: 1, ...selection });
  });
});

test('in-app Back restores the actual departing search after replaceState updates', () => {
  browserFixture('#/players?league=LPL&year=2025', (listeners) => {
    const stop = startRouter(() => {});
    updateRouteState({ query: 'BLG', page: 2 });
    const oldURL = window.location.href;
    window.location.hash = '#/player/Bin?team=BLG&league=LPL&year=2025';
    listeners.get('hashchange')({ oldURL });
    assert.equal(parseHash(backAction().href).query, 'BLG');
    assert.equal(parseHash(backAction().href).page, 2);
    stop();
  });
});

test('a transferred player’s old team cannot overwrite the new team’s match filters', () => {
  browserFixture('#/player/transfer?team=old&league=LPL&year=2025&result=win', () => {
    const oldTeam = parseHash();
    window.location.hash = '#/player/transfer?team=new&league=LPL&year=2025&result=loss';
    updateRouteState({ result: 'win' }, oldTeam);
    assert.equal(parseHash().teamId, 'new');
    assert.equal(parseHash().result, 'loss');
  });
});
