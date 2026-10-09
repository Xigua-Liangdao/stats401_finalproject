import test from 'node:test';
import assert from 'node:assert/strict';
import {
  markRouteLoadingWarmed,
  resetRouteLoadingWarmth,
  routeLoadingKey,
  SLOW_LOADING_MS,
} from '../utils/loading-line.js';

test('a dataset warns about the first load, then says the data is coming, and a long wait mentions a VPN', () => {
  resetRouteLoadingWarmth();
  assert.equal(routeLoadingKey({ datasetKey: 'LPL|2025', elapsedMs: 0 }), 'loading.first');
  assert.equal(routeLoadingKey({ datasetKey: 'LPL|2025', elapsedMs: SLOW_LOADING_MS - 1 }), 'loading.first');
  assert.equal(routeLoadingKey({ datasetKey: 'LPL|2025', elapsedMs: SLOW_LOADING_MS }), 'loading.vpn');
  markRouteLoadingWarmed('LPL|2025');
  assert.equal(routeLoadingKey({ datasetKey: 'LPL|2025', elapsedMs: 0 }), 'loading.arriving');
  assert.equal(routeLoadingKey({ datasetKey: 'LPL|2025', elapsedMs: SLOW_LOADING_MS }), 'loading.vpn');
  assert.equal(routeLoadingKey({ datasetKey: 'LCK|2025', elapsedMs: 0 }), 'loading.first');
});
