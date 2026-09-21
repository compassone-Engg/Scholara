// POST /api/chat — main chatbot endpoint.
//
// Request body:
//   { conversation_id, pseudonymous_id, profile, applying, favorites,
//     messages: [{role, content}, ...] }
//
// Response:
//   { reply, conversation_id, tool_calls_used, model, ... }

import { runChatTurn } from '../lib/llm.js';
import { TOOL_SCHEMAS, executeTool } from '../lib/tools.js';
import { SYSTEM_PROMPT, VERSION as PROMPT_VERSION } from '../lib/system-prompt.js';

const MAX_TURNS_IN_HISTORY = 20;
const MAX_TOOL_LOOPS = 6;
const DAILY_MESSAGE_CAP = 30;
const MAX_MSG_LENGTH = 4000;

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('invalid_json', 400);
  }

  const conversationId = String(body.conversation_id || '').slice(0, 64) || crypto.randomUUID();
  const pseudoId = String(body.pseudonymous_id || '').slice(0, 64);
  if (!pseudoId) return jsonError('missing_pseudonymous_id', 400);
  const messages = Array.isArray(body.messages) ? body.messages.slice(-MAX_TURNS_IN_HISTORY) : null;
  if (!messages || messages.length === 0) return jsonError('missing_messages', 400);

  // Validate user's last message
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  if (!lastUser) return jsonError('no_user_message', 400);
  if ((lastUser.content || '').length > MAX_MSG_LENGTH) return jsonError('message_too_long', 400);

  // Rate limit
  if (env.EVENTS_DB) {
    const today = new Date().toISOString().slice(0, 10);
    const now = Date.now();
    const stmt = env.EVENTS_DB.prepare(
      `INSERT INTO chat_rate_limit (pseudonymous_id, day, message_count, last_message_ts)
       VALUES (?, ?, 1, ?)
       ON CONFLICT (pseudonymous_id, day) DO UPDATE SET message_count = message_count + 1, last_message_ts = excluded.last_message_ts
       RETURNING message_count`
    );
    let count = 0;
    try {
      const row = await stmt.bind(pseudoId, today, now).first();
      count = row?.message_count || 0;
    } catch {}
    if (count > DAILY_MESSAGE_CAP) {
      return jsonError('daily_cap_reached', 429, { cap: DAILY_MESSAGE_CAP, count });
    }
  }

  // Load reference data (schools + checklists) from same-origin static assets.
  // Forward the caller's Authorization header so we pass the Basic Auth middleware.
  const origin = new URL(request.url).origin;
  const incomingAuth = request.headers.get('Authorization');
  const fetchHeaders = incomingAuth ? { 'Authorization': incomingAuth } : {};
  let schools = [];
  let checklists = {};
  try {
    const [sResp, cResp] = await Promise.all([
      fetch(`${origin}/data/schools.json`, { headers: fetchHeaders, cf: { cacheTtl: 300 } }),
      fetch(`${origin}/data/checklists.json`, { headers: fetchHeaders, cf: { cacheTtl: 300 } }),
    ]);
    if (!sResp.ok || !cResp.ok) {
      return jsonError('data_fetch_failed', 500, { schools_status: sResp.status, checklists_status: cResp.status });
    }
    schools = await sResp.json();
    checklists = await cResp.json();
  } catch (err) {
    return jsonError('data_load_failed', 500, { detail: String(err).slice(0, 200) });
  }

  const profile = body.profile || {};
  const applying = Array.isArray(body.applying) ? body.applying : [];
  const favorites = Array.isArray(body.favorites) ? body.favorites : [];
  const ctx = { profile, applying, favorites, schools, checklists };

  // Build a compact unitid -> name index so the LLM doesn't have to guess
  // numeric unitids. ~3KB across the 60 schools.
  const schoolsIndex = '\n\n# Schools reference (canonical unitids — use these exactly when calling tools)\n'
    + schools.map(s => `${s.unitid} | ${s.short} | ${s.name} | ${s.state}`).join('\n');
  const augmentedSystem = SYSTEM_PROMPT + schoolsIndex;

  // Conversation loop with tool calling
  const startedAt = Date.now();
  const turnId = crypto.randomUUID();
  let runningMessages = messages.map(m => ({ role: m.role, content: m.content || '' }));
  const toolCallsLog = [];
  let lastResp = null;
  let provider = 'gemini';
  let model = 'gemini-3.5-flash';

  for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
    const turn = await runChatTurn({
      provider,
      model,
      system: augmentedSystem,
      messages: runningMessages,
      tools: TOOL_SCHEMAS,
      env,
    });
    lastResp = turn;

    if (!turn.tool_calls || turn.tool_calls.length === 0) {
      break; // model produced a final reply
    }

    // Append the model's tool-call turn
    runningMessages.push({ role: 'assistant', tool_calls: turn.tool_calls });

    // Execute each tool call and append results
    for (const tc of turn.tool_calls) {
      let result;
      try {
        result = await executeTool(tc.name, tc.args || {}, ctx);
      } catch (err) {
        result = { error: 'tool_exception', name: tc.name, message: String(err).slice(0, 200) };
      }
      toolCallsLog.push({ tool: tc.name, args: tc.args });
      runningMessages.push({
        role: 'tool',
        tool_name: tc.name,
        content: typeof result === 'string' ? result : JSON.stringify(result).slice(0, 8000),
      });
    }
  }

  const durationMs = Date.now() - startedAt;

  // Telemetry — write a row, but never block on failure
  if (env.EVENTS_DB) {
    try {
      await env.EVENTS_DB.prepare(
        `INSERT INTO chat_turns (id, pseudonymous_id, conversation_id, role, model, provider, input_tokens, output_tokens, tool_calls_json, duration_ms, app_version, client_timestamp)
         VALUES (?, ?, ?, 'assistant', ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        turnId, pseudoId, conversationId,
        lastResp?.model_used || model, provider,
        lastResp?.input_tokens || 0, lastResp?.output_tokens || 0,
        JSON.stringify(toolCallsLog).slice(0, 4000),
        durationMs, PROMPT_VERSION, Date.now()
      ).run();
    } catch {}
  }

  return new Response(JSON.stringify({
    reply: lastResp?.reply || '',
    conversation_id: conversationId,
    turn_id: turnId,
    tool_calls_used: toolCallsLog.map(t => t.tool),
    model: lastResp?.model_used,
    provider,
    duration_ms: durationMs,
    placeholder: !!lastResp?.placeholder,
    error: lastResp?.error,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function jsonError(code, status = 400, extra = {}) {
  return new Response(JSON.stringify({ error: code, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
