export const href = {
  home: '#/',
  players: '#/players',
  playersAt: (page) => catalogueHref('players', page),
  player: (id, teamId, season) => {
    const params = new URLSearchParams();
    if (teamId) params.set('team', teamId);
    if (season) params.set('season', String(season));
    return `#/player/${encodeURIComponent(id)}${params.size ? `?${params}` : ''}`;
  },
  lineup: (id) => `#/lineup/${encodeURIComponent(id)}`,
  team: (id) => `#/team/${encodeURIComponent(id)}`,
};

const CATALOGUE_PAGE_KEYS = {
  players: 'catalogue-page-players',
};

function clampPage(value) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function catalogueHref(kind, page) {
  const n = clampPage(page);
  return n > 1 ? `#/players/${n}` : '#/players';
}

export function readCataloguePage(kind) {
  try {
    return clampPage(sessionStorage.getItem(CATALOGUE_PAGE_KEYS[kind]));
  } catch {
    return 1;
  }
}

export function writeCataloguePage(kind, page) {
  try {
    sessionStorage.setItem(CATALOGUE_PAGE_KEYS[kind], String(clampPage(page)));
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

const BACK_STACK_KEY = 'nav-back-stack';
const BACK_STACK_MAX = 8;
const BACK_ROOTS = new Set(['home', 'players']);

function normalizeHash(hash) {
  const value = hash || '#/';
  return value.startsWith('#') ? value : `#${value}`;
}

function readBackStack() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(BACK_STACK_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function writeBackStack(stack) {
  try {
    sessionStorage.setItem(BACK_STACK_KEY, JSON.stringify(stack.slice(-BACK_STACK_MAX)));
  } catch {
    /* ignore quota / private mode */
  }
}

function recordNavigation(fromHash, toHash) {
  const from = normalizeHash(fromHash);
  const to = normalizeHash(toHash);
  if (from === to) return;

  const toRoute = parseHash(to);
  if (BACK_ROOTS.has(toRoute.name)) {
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
  if (route.name === 'players') return 'Back to catalogue';
  if (route.name === 'team') return 'Back to team';
  if (route.name === 'lineup') return 'Back to lineup';
  if (route.name === 'player') return 'Back to player';
  if (route.name === 'home') return 'Back to home';
  return 'Back';
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

  if (parts.length === 0) return { name: 'home' };
  if (parts[0] === 'players') {
    if (parts[1] && !/^\d+$/.test(parts[1])) return { name: 'not-found' };
    return { name: 'players', page: parseCataloguePage(parts[1]) };
  }
  if (parts[0] === 'player' && parts[1]) return {
    name: 'player', id: decodeURIComponent(parts[1]),
    teamId: params.get('team'), season: params.get('season'),
  };
  if (parts[0] === 'lineups') {
    if (parts[1] && !/^\d+$/.test(parts[1])) return { name: 'not-found' };
    return { name: 'players', page: parseCataloguePage(parts[1]) };
  }
  if (parts[0] === 'lineup' && parts[1]) return { name: 'lineup', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'team' && parts[1]) return { name: 'team', id: decodeURIComponent(parts[1]) };
  return { name: 'not-found' };
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
