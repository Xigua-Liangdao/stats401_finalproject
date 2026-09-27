let selected = null;

// Fixed until the choices are the directory names under data/processed.
export const AVAILABLE_SEASONS = ['2025'];

export function seasonOptions() {
  return AVAILABLE_SEASONS;
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
