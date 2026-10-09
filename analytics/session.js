const STORAGE_KEY = 'analytics_session_id';

let memoryId = null;

export function readOrCreateSessionId() {
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (existing) return { id: existing, created: false };
    const id = crypto.randomUUID();
    sessionStorage.setItem(STORAGE_KEY, id);
    return { id, created: true };
  } catch {
    if (!memoryId) memoryId = crypto.randomUUID();
    return { id: memoryId, created: false };
  }
}

export function getSessionId() {
  return readOrCreateSessionId().id;
}
