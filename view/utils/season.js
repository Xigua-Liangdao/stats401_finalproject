const STORAGE_KEY = 'stats401-dataset';
let manifest;
let manifestPromise;
let selected;

export function validateManifest(value) {
  if (value?.version !== 1 || !Array.isArray(value.datasets) || !value.datasets.length) {
    throw new Error('Invalid datasets.json manifest.');
  }
  const seen = new Set();
  for (const entry of value.datasets) {
    const key = datasetKey(entry);
    if (!entry.league || !Number.isInteger(Number(entry.year)) || seen.has(key)
      || !['ready', 'unavailable'].includes(entry.status)
      || (entry.compression != null && entry.compression !== 'gzip')
      || (entry.status === 'ready' && !/^[a-z0-9_-]+\/\d{4}$/.test(entry.path))) {
      throw new Error(`Invalid dataset entry: ${key}`);
    }
    seen.add(key);
  }
  return value;
}

export function datasetKey(entry) {
  return entry ? `${entry.league}|${entry.year}` : '';
}

export function leagueOptions(value = manifest) {
  return [...new Set((value?.datasets ?? []).map((entry) => entry.league))].sort();
}

export function seasonOptions(league = selected?.league, value = manifest) {
  return (value?.datasets ?? []).filter((entry) => entry.league === league)
    .sort((a, b) => Number(b.year) - Number(a.year));
}

// Only manifest entries are choices. A missing year never invents a data path.
export function resolveDatasetSelection(value, request = {}, fallback = value.default ?? {}) {
  fallback ??= {};
  const requestedLeague = request.league || fallback.league || value.default?.league;
  let choices = seasonOptions(requestedLeague, value);
  if (!choices.length) choices = seasonOptions(value.default?.league, value);
  if (!choices.length) choices = [...value.datasets];
  const year = request.year ?? request.season ?? fallback.year;
  const explicitYear = request.year != null || request.season != null;
  return choices.find((entry) => String(entry.year) === String(year)
    && (!request.league || explicitYear || entry.status === 'ready'))
    ?? choices.find((entry) => entry.status === 'ready' && String(entry.year) === String(value.default?.year))
    ?? choices.find((entry) => entry.status === 'ready') ?? choices[0];
}

function storedSelection() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

export function loadDatasetManifest() {
  if (!manifestPromise) {
    const url = new URL('../../data/datasets.json', import.meta.url);
    url.search = new URL(import.meta.url).search;
    manifestPromise = fetch(url).then(async (response) => {
      if (!response.ok) throw new Error(`Failed to load datasets.json (${response.status})`);
      manifest = validateManifest(await response.json());
      return manifest;
    }).catch((error) => {
      manifestPromise = null;
      throw error;
    });
  }
  return manifestPromise;
}

export function setDatasetSelection(request = {}) {
  if (!manifest) throw new Error('Load datasets.json before selecting a dataset.');
  const saved = selected ?? storedSelection() ?? manifest.default;
  selected = resolveDatasetSelection(manifest, request, saved);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ league: selected.league, year: selected.year }));
  } catch { /* Keep the selection in memory in private mode. */ }
  return selected;
}

export async function ensureDataset() {
  if (selected) return selected;
  await loadDatasetManifest();
  return selected ?? setDatasetSelection();
}

export function getSelectedDataset() {
  return selected ?? null;
}

export function getSelectedSeason() {
  return selected ? String(selected.year) : null;
}
