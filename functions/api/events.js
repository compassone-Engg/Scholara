// POST /api/events — accepts a batch of anonymized events and writes them
// to the EVENTS_DB D1 binding. The Basic Auth middleware (functions/_middleware.js)
// runs first, so this endpoint is closed-beta-gated for free.

const MAX_BATCH = 100;
const MAX_PAYLOAD = 4096;
const MAX_EVENT_TYPE = 64;
const MAX_VERSION = 32;
const MAX_PSEUDO = 64;

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const events = Array.isArray(body?.events) ? body.events : null;
  if (!events || events.length === 0) {
    return json({ error: 'no_events' }, 400);
  }
  if (events.length > MAX_BATCH) {
    return json({ error: 'batch_too_large', max: MAX_BATCH }, 400);
  }

  if (!env.EVENTS_DB) {
    return json({ error: 'events_db_not_configured' }, 503);
  }

  const stmt = env.EVENTS_DB.prepare(
    'INSERT INTO student_events (id, pseudonymous_id, event_type, payload, app_version, client_timestamp) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const batch = [];
  for (const e of events) {
    if (!e || typeof e !== 'object') continue;
    const id = clip(e.id, 64) || crypto.randomUUID();
    const pseudo = clip(e.pseudonymous_id, MAX_PSEUDO);
    const type = clip(e.event_type, MAX_EVENT_TYPE);
    if (!pseudo || !type) continue;
    const payload = e.payload != null ? clip(String(e.payload), MAX_PAYLOAD) : null;
    const version = clip(e.app_version, MAX_VERSION);
    const clientTs = Number.isFinite(e.client_timestamp) ? e.client_timestamp : null;
    batch.push(stmt.bind(id, pseudo, type, payload, version, clientTs));
  }

  if (batch.length === 0) {
    return json({ error: 'all_events_invalid' }, 400);
  }

  try {
    await env.EVENTS_DB.batch(batch);
  } catch (err) {
    return json({ error: 'db_error' }, 500);
  }

  return json({ ok: true, accepted: batch.length });
}

function clip(v, max) {
  if (v == null) return null;
  const s = String(v);
  return s.length > max ? s.slice(0, max) : s;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
