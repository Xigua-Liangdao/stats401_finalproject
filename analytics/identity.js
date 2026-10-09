const STORAGE_KEY = 'analytics_anonymous_id';

let memoryId = null;

export function readOrCreateAnonymousId() {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return { id: existing, created: false };
    const id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
    return { id, created: true };
  } catch {
    if (!memoryId) memoryId = crypto.randomUUID();
    return { id: memoryId, created: false };
  }
}

export function getAnonymousId() {
  return readOrCreateAnonymousId().id;
}
