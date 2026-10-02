import { languagePacks } from '../../data/lang/index.js';

/** Source string plus every language pack's translation of that key. */
export function nameForms(group, raw) {
  if (raw == null || raw === '') return [];
  const key = String(raw);
  const forms = [key];
  for (const pack of Object.values(languagePacks)) {
    const translated = pack?.names?.[group]?.[key];
    if (translated) forms.push(String(translated));
  }
  return forms;
}

export function matchesQuery(needle, parts) {
  const query = String(needle ?? '').trim().toLowerCase();
  if (!query) return true;
  return parts.some((part) => String(part ?? '').toLowerCase().includes(query));
}

export function entityNameParts(group, record) {
  if (!record) return [];
  return [...nameForms(group, record.sourceName), record.short].filter((part) => part != null && part !== '');
}

function peopleInGroup(group) {
  const people = [...(group.players ?? [])];
  for (const lineup of group.lineups ?? []) people.push(...(lineup.players ?? []));
  return people;
}

export function groupMatches(group, needle) {
  const parts = [
    ...entityNameParts('teams', group?.team),
    ...peopleInGroup(group ?? {}).flatMap((player) => entityNameParts('players', player)),
  ];
  return matchesQuery(needle, parts);
}
