const HEALTH_PATH = '/health';
const SUMMARY_PATH = '/summarize';

function endpoint() {
  return document.querySelector('meta[name="assistant-endpoint"]')?.getAttribute('content')?.trim() || '';
}

function endpointUrl(path) {
  const base = endpoint();
  if (!base) return null;
  return new URL(path, base.endsWith('/') ? base : `${base}/`);
}

let online = null;

export function assistantConfigured() {
  return Boolean(endpoint());
}

export function noteAssistantFailure() {
  online = false;
}

export async function assistantOnline() {
  if (!assistantConfigured()) return false;
  if (online != null) return online;
  const url = endpointUrl(HEALTH_PATH);
  try {
    const response = await fetch(url, { method: 'GET' });
    online = response.ok;
  } catch (error) {
    console.error('[Assistant] health check failed:', error);
    online = false;
  }
  return online;
}

export async function requestSummary(question, context) {
  const url = endpointUrl(SUMMARY_PATH);
  if (!url) throw new Error('Assistant endpoint is not configured.');
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question, context }),
  });
  if (!response.ok) throw new Error(`Assistant summary failed (${response.status}).`);
  const payload = await response.json();
  const reply = typeof payload?.reply === 'string' ? payload.reply.trim() : '';
  if (!reply) throw new Error('Assistant summary was empty.');
  return reply;
}
