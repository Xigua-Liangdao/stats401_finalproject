import test from 'node:test';
import assert from 'node:assert/strict';
import { trackUi } from '../utils/track.js';

function wait() {
  return new Promise((resolve) => setTimeout(resolve, 50));
}

test('a tracking failure is logged and does not interrupt the caller', async () => {
  const seen = [];
  const original = console.error;
  console.error = (...args) => { seen.push(args); };
  let continued = false;
  try {
    trackUi({ event_name: 'click', page: 'home', target_type: 'isolation' });
    continued = true;
    await wait();
  } finally {
    console.error = original;
  }
  assert.equal(continued, true);
  assert.ok(seen.some((args) => String(args[0]).includes('[Analytics] trackEvent failed')));
});
