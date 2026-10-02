import test from 'node:test';
import assert from 'node:assert/strict';
import { entityNameParts, groupMatches, matchesQuery, nameForms } from '../utils/search-text.js';

const legend = {
  team: { sourceName: "Anyone's Legend", short: 'AL' },
  players: [{ sourceName: 'Hope' }, { sourceName: 'Flandre' }],
};

test('a player name selects the team that fields them', () => {
  assert.equal(groupMatches(legend, 'hope'), true);
  assert.equal(groupMatches(legend, 'HOP'), true);
  assert.equal(groupMatches(legend, 'legend'), true);
  assert.equal(groupMatches(legend, 'al'), true);
  assert.equal(groupMatches(legend, 'bin'), false);
});

test('translated names match even when the page language is different', () => {
  const forms = nameForms('champions', 'Ahri');
  assert.ok(forms.includes('Ahri'));
  assert.ok(forms.includes('阿狸'));
  assert.equal(matchesQuery('阿狸', forms), true);
  assert.equal(matchesQuery('ahri', entityNameParts('champions', { sourceName: 'Ahri' })), true);
});
