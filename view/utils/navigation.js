export const href = {
  home: '#/',
  players: '#/players',
  player: (id) => `#/player/${encodeURIComponent(id)}`,
  lineups: '#/lineups',
  lineup: (id) => `#/lineup/${encodeURIComponent(id)}`,
  team: (id) => `#/team/${encodeURIComponent(id)}`,
};

export function parseHash(hash = window.location.hash) {
  const path = (hash || '#/').replace(/^#/, '') || '/';
  const parts = path.split('/').filter(Boolean);

  if (parts.length === 0) return { name: 'home' };
  if (parts[0] === 'players') return { name: 'players' };
  if (parts[0] === 'player' && parts[1]) return { name: 'player', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'lineups') return { name: 'lineups' };
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
