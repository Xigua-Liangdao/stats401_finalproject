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
  lineups: '#/lineups',
  lineupsAt: (page) => catalogueHref('lineups', page),
  lineup: (id) => `#/lineup/${encodeURIComponent(id)}`,
  team: (id) => `#/team/${encodeURIComponent(id)}`,
};

const CATALOGUE_PAGE_KEYS = {
  players: 'catalogue-page-players',
  lineups: 'catalogue-page-lineups',
};

function clampPage(value) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function catalogueHref(kind, page) {
  const base = kind === 'lineups' ? 'lineups' : 'players';
  const n = clampPage(page);
  return n > 1 ? `#/${base}/${n}` : `#/${base}`;
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
    return { name: 'lineups', page: parseCataloguePage(parts[1]) };
  }
  if (parts[0] === 'lineup' && parts[1]) return { name: 'lineup', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'team' && parts[1]) return { name: 'team', id: decodeURIComponent(parts[1]) };
  return { name: 'not-found' };
}

export function navigate(to) {
  window.location.hash = to.replace(/^#/, '');
}

export function startRouter(onRoute) {
  const handle = () => onRoute(parseHash());
  window.addEventListener('hashchange', handle);
  if (!window.location.hash) window.location.hash = '/';
  else handle();
  return () => window.removeEventListener('hashchange', handle);
}
