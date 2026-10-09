import { t } from './i18n.js';
import { datasetKey, getSelectedDataset } from './season.js';

export function withDataset(hash, selection = getSelectedDataset()) {
  const [path, query] = hash.split('?');
  const params = new URLSearchParams(query);
  if (selection) {
    params.set('league', selection.league);
    params.set('year', String(selection.year));
    params.delete('season');
  }
  return `${path}${params.size ? `?${params}` : ''}`;
}

export const href = {
  get home() { return withDataset('#/'); },
  get players() { return withDataset('#/players'); },
  get compare() { return withDataset('#/compare'); },
  playersAt: (page) => catalogueHref('players', page),
  player: (id, teamId, season) => {
    const params = new URLSearchParams();
    if (teamId) params.set('team', teamId);
    if (season) params.set('year', String(season));
    return withDataset(`#/player/${encodeURIComponent(id)}${params.size ? `?${params}` : ''}`);
  },
  lineup: (id) => withDataset(`#/lineup/${encodeURIComponent(id)}`),
  team: (id) => withDataset(`#/team/${encodeURIComponent(id)}`),
};

export function routeHref(route, selection = getSelectedDataset()) {
  let path = '#/';
  const params = new URLSearchParams();
  if (route.name === 'players') path = route.page > 1 ? `#/players/${route.page}` : '#/players';
  else if (route.name === 'compare') path = '#/compare';
  else if (['player', 'team', 'lineup'].includes(route.name)) {
    path = `#/${route.name}/${encodeURIComponent(route.id)}`;
    if (route.teamId) params.set('team', route.teamId);
  } else if (route.name === 'not-found') path = '#/not-found';
  return withDataset(`${path}${params.size ? `?${params}` : ''}`, selection);
}

export function routeAfterDatasetChange(route) {
  return ['player', 'team', 'lineup', 'not-found'].includes(route.name)
    ? { name: 'players', page: 1 }
    : { name: route.name, ...(route.name === 'players' ? { page: 1 } : {}) };
}

export function datasetRequestForRoute(route, defaults) {
  defaults ??= {};
  // Legacy detail links came from the original single LPL dataset. A browser's
  // saved new selection must not reinterpret their IDs in another league/year.
  if (!route.league && ['player', 'team', 'lineup'].includes(route.name)) {
    return { ...route, league: defaults.league, year: route.year ?? route.season ?? defaults.year };
  }
  if (route.year && !route.league) return { ...route, league: defaults.league };
  return route;
}

const CATALOGUE_PAGE_KEYS = {
  players: 'catalogue-page-players',
};

function clampPage(value) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function catalogueHref(kind, page) {
  const n = clampPage(page);
  return withDataset(n > 1 ? `#/players/${n}` : '#/players');
}

function catalogueKey(kind) {
  return `${CATALOGUE_PAGE_KEYS[kind]}:${datasetKey(getSelectedDataset())}`;
}

export function readCataloguePage(kind) {
  try {
    return clampPage(sessionStorage.getItem(catalogueKey(kind)));
  } catch {
    return 1;
  }
}

export function writeCataloguePage(kind, page) {
  try {
    sessionStorage.setItem(catalogueKey(kind), String(clampPage(page)));
  } catch {
    /* ignore quota / private mode */
  }
}

export function rememberCataloguePage(kind, page) {
  writeCataloguePage(kind, page);
  return (next) => {
    writeCataloguePage(kind, next);
    const nextHash = catalogueHref(kind, next);
    const url = `${window.location.pathname}${window.location.search}${nextHash}`;
    history.replaceState(null, '', url);
  };
}

const backStackKey = () => `nav-back-stack:${datasetKey(getSelectedDataset())}`;
const BACK_STACK_MAX = 8;
const BACK_ROOTS = new Set(['home', 'players', 'compare']);

function normalizeHash(hash) {
  const value = hash || '#/';
  return value.startsWith('#') ? value : `#${value}`;
}

function readBackStack() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(backStackKey()) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function writeBackStack(stack) {
  try {
    sessionStorage.setItem(backStackKey(), JSON.stringify(stack.slice(-BACK_STACK_MAX)));
  } catch {
    /* ignore quota / private mode */
  }
}

function recordNavigation(fromHash, toHash) {
  const from = normalizeHash(fromHash);
  const to = normalizeHash(toHash);
  if (from === to) return;

  const toRoute = parseHash(to);
  const fromRoute = parseHash(from);
  if (BACK_ROOTS.has(toRoute.name) || fromRoute.league !== toRoute.league || fromRoute.year !== toRoute.year) {
    writeBackStack([]);
    return;
  }

  const stack = readBackStack();
  if (stack.at(-1) === to) {
    stack.pop();
  } else if (parseHash(from).name !== 'not-found' && stack.at(-1) !== from) {
    stack.push(from);
  }
  writeBackStack(stack);
}

function peekBackHref() {
  return readBackStack().at(-1) || null;
}

function labelForBack(targetHref) {
  const route = parseHash(targetHref);
  if (route.name === 'players') return t('nav.backCatalogue');
  if (route.name === 'team') return t('nav.backTeam');
  if (route.name === 'lineup') return t('nav.backLineup');
  if (route.name === 'player') return t('nav.backPlayer');
  if (route.name === 'home') return t('nav.backHome');
  if (route.name === 'compare') return t('nav.backComparison');
  return t('nav.back');
}

export function backAction(fallbackHref = href.players) {
  const target = peekBackHref() || fallbackHref;
  return { href: target, label: labelForBack(target) };
}

function parseCataloguePage(value) {
  if (value == null || value === '') return 1;
  return clampPage(value);
}

export function parseHash(hash = window.location.hash) {
  const [path, query] = ((hash || '#/').replace(/^#/, '') || '/').split('?');
  const params = new URLSearchParams(query);
  const parts = path.split('/').filter(Boolean);
  const context = {};
  if (params.has('league')) context.league = params.get('league');
  if (params.has('year') || params.has('season')) context.year = params.get('year') ?? params.get('season');
  const route = (record) => ({ ...record, ...context });

  if (parts.length === 0) return route({ name: 'home' });
  if (parts[0] === 'compare' && parts.length === 1) return route({ name: 'compare' });
  if (parts[0] === 'players') {
    if (parts[1] && !/^\d+$/.test(parts[1])) return { name: 'not-found' };
    return route({ name: 'players', page: parseCataloguePage(parts[1]) });
  }
  let id;
  try { id = parts[1] ? decodeURIComponent(parts[1]) : null; }
  catch { return route({ name: 'not-found' }); }
  if (parts[0] === 'player' && id) return route({
    name: 'player', id,
    teamId: params.get('team'), season: context.year ?? null,
  });
  if (parts[0] === 'lineups') {
    if (parts[1] && !/^\d+$/.test(parts[1])) return { name: 'not-found' };
    return route({ name: 'players', page: parseCataloguePage(parts[1]) });
  }
  if (parts[0] === 'lineup' && id) return route({ name: 'lineup', id });
  if (parts[0] === 'team' && id) return route({ name: 'team', id });
  return route({ name: 'not-found' });
}

export function navigate(to) {
  window.location.hash = to.replace(/^#/, '');
}

export function startRouter(onRoute) {
  let lastHash = null;
  const handle = () => {
    const nextHash = normalizeHash(window.location.hash || '#/');
    if (lastHash) recordNavigation(lastHash, nextHash);
    lastHash = nextHash;
    onRoute(parseHash(nextHash));
  };
  window.addEventListener('hashchange', handle);
  if (!window.location.hash) window.location.hash = '/';
  else handle();
  return () => window.removeEventListener('hashchange', handle);
}
