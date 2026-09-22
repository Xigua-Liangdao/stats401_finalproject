/**
 * Monotonic startup progress. Catalog milestones push it toward 92.
 * The first rendered route sets 100 once that page is actually ready.
 */

const listeners = new Set();
let current = 0;

export function getLoadProgress() {
  return current;
}

export function setLoadProgress(next) {
  const value = Math.max(0, Math.min(100, next));
  if (value <= current) return;
  current = value;
  for (const listener of listeners) listener(current);
}

export function onLoadProgress(listener) {
  listener(current);
  listeners.add(listener);
  return () => listeners.delete(listener);
}
