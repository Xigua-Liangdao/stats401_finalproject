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
  };
}

function logIdentity(label, record) {
  const note = record.created ? ' (created)' : ' (retrieved)';
  console.log(`[Analytics] ${label}: ${record.id}${note}`);
}

export function initAnalytics() {
  const anonymous = readOrCreateAnonymousId();
  const session = readOrCreateSessionId();
  const isTest = isDeveloperMode();
  if (!started) {
    started = true;
    console.log('[Analytics] initialized');
    logIdentity('anonymous_id', anonymous);
    logIdentity('session_id', session);
    console.log(`[Analytics] is_test: ${isTest}`);
  }
  bindDeveloperMode();
  syncDeveloperIndicator();
  window.getAnalyticsContext = getAnalyticsContext;
}
