const QUESTION_LIMIT = 500;
const CONTEXT_LIMIT = 4000;
const PROBE_TTL_MS = 60_000;

const SYSTEM = [
  'You explain one chart on a League of Legends lineup statistics site.',
  'Use only the page text in the user message. Do not invent numbers, names, or causes.',
  'Reply in the same language as the question, in at most 4 sentences.',
].join(' ');

let probe = { at: 0, ok: false };

export function originAllowed(origin, extra = '') {
  if (!origin) return false;
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const host = url.hostname;
  const https = url.protocol === 'https:';
  if ((host === 'localhost' || host === '127.0.0.1') && (https || url.protocol === 'http:')) return true;
  if (https && (host === 'github.io' || host.endsWith('.github.io'))) return true;
  return extra.split(',').map((item) => item.trim()).filter(Boolean).includes(origin);
}

export function readReply(payload) {
  const text = payload?.choices?.[0]?.message?.content;
  return typeof text === 'string' ? text.trim() : '';
}

export function gatewayUrls(raw) {
  const trimmed = String(raw ?? '').replace(/\/$/, '');
  const root = trimmed.endsWith('/chat/completions')
    ? trimmed.slice(0, -'/chat/completions'.length)
    : trimmed;
  return {
    models: `${root}/models`,
    chat: `${root}/chat/completions`,
  };
}

function json(body, status, origin) {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (origin) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-methods', 'GET, POST, OPTIONS');
    headers.set('access-control-allow-headers', 'content-type');
    headers.set('vary', 'Origin');
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function configured(env) {
  return Boolean(env.AI_API_KEY && env.AI_API_URL && !env.AI_API_URL.includes('example.invalid'));
}

async function upstreamOk(env) {
  if (!configured(env)) return false;
  if (Date.now() - probe.at < PROBE_TTL_MS) return probe.ok;
  let ok = false;
  try {
    const response = await fetch(gatewayUrls(env.AI_API_URL).models, {
      method: 'GET',
      headers: { authorization: `Bearer ${env.AI_API_KEY}` },
      signal: AbortSignal.timeout(6000),
    });
    ok = response.ok;
  } catch (error) {
    console.error('[Assistant] upstream probe failed:', error instanceof Error ? error.message : 'request failed');
    ok = false;
  }
  probe = { at: Date.now(), ok };
  return ok;
}

async function summarize(env, question, context) {
  const response = await fetch(gatewayUrls(env.AI_API_URL).chat, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.AI_MODEL,
      temperature: 0.2,
      max_tokens: 280,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Question: ${question}\n\nPage:\n${context}` },
      ],
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Upstream status ${response.status}`);
  return readReply(await response.json());
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = originAllowed(origin, env.ALLOWED_ORIGINS || '');
    if (request.method === 'OPTIONS') {
      return allowed ? json({ ok: true }, 204, origin) : json({ error: 'origin' }, 403);
    }
    if (!allowed) return json({ error: 'origin' }, 403);

    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      const ok = await upstreamOk(env);
      return json({ ok }, ok ? 200 : 503, origin);
    }
    if (request.method !== 'POST' || url.pathname !== '/summarize') {
      return json({ error: 'not-found' }, 404, origin);
    }
    if (!configured(env)) return json({ error: 'unconfigured' }, 503, origin);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'bad-json' }, 400, origin);
    }
    const question = String(body?.question ?? '').trim().slice(0, QUESTION_LIMIT);
    const context = String(body?.context ?? '').trim().slice(0, CONTEXT_LIMIT);
    if (!question || !context) return json({ error: 'missing' }, 400, origin);

    try {
      const reply = await summarize(env, question, context);
      if (!reply) return json({ error: 'empty' }, 502, origin);
      probe = { at: Date.now(), ok: true };
      return json({ reply }, 200, origin);
    } catch (error) {
      console.error('[Assistant] summarize failed:', error instanceof Error ? error.message : 'request failed');
      probe = { at: Date.now(), ok: false };
      return json({ error: 'upstream' }, 502, origin);
    }
  },
};
