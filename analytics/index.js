import { currentDevice, watchDevice } from './device.js';
import { bindDeveloperMode, isDeveloperMode, syncDeveloperIndicator } from './developerMode.js';
import { getAnonymousId, readOrCreateAnonymousId } from './identity.js';
import { getSessionId, readOrCreateSessionId } from './session.js';

export { trackEvent } from './tracker.js';

let started = false;

export function getAnalyticsContext() {
  return {
    anonymous_id: getAnonymousId(),
    session_id: getSessionId(),
    is_test: isDeveloperMode(),
    device: currentDevice(),
  };
}

function logIdentity(label, record) {
  const note = record.created ? ' (created)' : ' (retrieved)';
  console.log(`[Analytics] ${label}: ${record.id}${note}`);
}

export function initAnalytics() {
  try {
    watchDevice();
    const anonymous = readOrCreateAnonymousId();
    const session = readOrCreateSessionId();
    if (!started) {
      started = true;
      logIdentity('anonymous_id', anonymous);
      logIdentity('session_id', session);
    }
    bindDeveloperMode();
    syncDeveloperIndicator();
    window.getAnalyticsContext = getAnalyticsContext;
  } catch (error) {
    console.error('[Analytics] init failed:', error);
  }
}
