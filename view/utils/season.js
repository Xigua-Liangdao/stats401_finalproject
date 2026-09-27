let selected = null;

export function seasonOptions(catalog) {
  return [...new Set(catalog.teams.map((team) => team.season))]
    .filter((season) => season != null && season !== '')
    .sort((a, b) => Number(b) - Number(a));
}

export function ensureSeason(seasons) {
  const list = seasons.map(String);
  if (selected == null || !list.includes(String(selected))) {
    selected = list[0] ?? null;
  }
  return selected;
}

export function getSelectedSeason() {
  return selected;
}

export function setSelectedSeason(value) {
  selected = value == null ? null : String(value);
}
