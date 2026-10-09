export const SLOW_LOADING_MS = 8000;

const warmed = new Set();

export function routeLoadingKey({ datasetKey = '', elapsedMs = 0 } = {}) {
  if (elapsedMs >= SLOW_LOADING_MS) return 'loading.vpn';
  if (!warmed.has(datasetKey)) return 'loading.first';
  return 'loading.arriving';
}

export function markRouteLoadingWarmed(datasetKey = '') {
  warmed.add(datasetKey);
}

export function resetRouteLoadingWarmth() {
  warmed.clear();
}
