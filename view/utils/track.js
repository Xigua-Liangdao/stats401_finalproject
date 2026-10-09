import { parseHash } from './navigation.js';

const PAGE_BY_ROUTE = {
  home: 'home',
  players: 'catalogue',
  player: 'player',
  team: 'team',
  lineup: 'lineup',
  compare: 'comparison',
  'not-found': 'not-found',
};

export function currentPage() {
  const route = parseHash();
  return PAGE_BY_ROUTE[route.name] ?? route.name;
}

export function routeTargetId(hash) {
  const route = parseHash(hash || '#/');
  if (route.name === 'home') return 'home';
  if (route.name === 'players') return 'catalogue';
  if (route.name === 'compare') return 'comparison';
  if (route.id) return String(route.id);
  return route.name;
}

export const TOOLTIP_DWELL_MS = 500;

export function createTooltipWatch(targetType) {
  let timer = 0;
  let pendingId = '';
  let openId = '';

  return {
    show(targetId) {
      const id = targetId == null ? '' : String(targetId);
      if (!id || id === openId || id === pendingId) return;
      window.clearTimeout(timer);
      pendingId = id;
      timer = window.setTimeout(() => {
        if (pendingId !== id) return;
        pendingId = '';
        openId = id;
        trackUi({
          event_name: 'tooltip_open',
          target_type: targetType,
          target_id: id,
        });
      }, TOOLTIP_DWELL_MS);
    },
    hide() {
      window.clearTimeout(timer);
      timer = 0;
      pendingId = '';
      openId = '';
    },
  };
}

function reportFailure(error) {
  console.error('[Analytics] trackEvent failed:', error);
}

export function trackUi(event) {
  try {
    const payload = {
      page: event?.page || currentPage(),
      event_name: event?.event_name,
    };
    if (event?.target_type) payload.target_type = event.target_type;
    if (event?.target_id != null && event.target_id !== '') payload.target_id = String(event.target_id);
    if (event?.metadata != null) payload.metadata = event.metadata;
    import('../../analytics/index.js')
      .then(({ trackEvent }) => trackEvent(payload))
      .catch(reportFailure);
  } catch (error) {
    reportFailure(error);
  }
}
