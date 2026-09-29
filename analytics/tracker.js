import { isDeveloperMode } from './developerMode.js';
import { getAnonymousId } from './identity.js';
import { getSessionId } from './session.js';
import { supabase } from './supabase.js';

const EVENT_NAMES = new Set([
  'click',
  'tooltip_open',
  'search_open',
  'filter_change',
  'sort_change',
]);

function reportFailure(error) {
  if (!isDeveloperMode()) return;
  const message = error?.message || 'unknown analytics error';
  console.error(`[Analytics] trackEvent failed: ${message}`);
}

async function sendEvent(event) {
  const { event_name, page, target_type, target_id, metadata } = event ?? {};
  if (!EVENT_NAMES.has(event_name)) {
    reportFailure(new Error(`Unknown event_name: ${event_name}`));
    return;
  }
  const { error } = await supabase.from('events').insert({
    anonymous_id: getAnonymousId(),
    session_id: getSessionId(),
    is_test: isDeveloperMode(),
    event_name,
    page,
    target_type,
    target_id,
    metadata,
  });
  if (error) reportFailure(error);
}

export function trackEvent(event) {
  return sendEvent(event).catch((error) => {
    reportFailure(error);
  });
}
