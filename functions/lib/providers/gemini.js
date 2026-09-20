// Gemini 2.5 Flash provider. Implements function calling per:
// https://ai.google.dev/gemini-api/docs/function-calling

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-2.5-flash';

export async function runGeminiTurn({ model, system, messages, tools, env }) {
  const apiKey = env?.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'PLACEHOLDER_REPLACE_WITH_REAL_KEY') {
    return {
      reply: "The chatbot isn't fully configured yet — the AI API key hasn't been set on this deployment. Ask the operator to provision a Gemini API key (90 seconds at aistudio.google.com → Get API key) and store it as the GEMINI_API_KEY Cloudflare Pages secret.",
      tool_calls: [],
      input_tokens: 0,
      output_tokens: 0,
      model_used: 'placeholder',
      placeholder: true,
    };
  }

  const useModel = model || DEFAULT_MODEL;

  // Convert normalized messages → Gemini contents
  const contents = [];
  for (const m of messages) {
    if (m.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: m.content }] });
    } else if (m.role === 'assistant') {
      if (m.tool_calls && m.tool_calls.length > 0) {
        contents.push({
          role: 'model',
          parts: m.tool_calls.map(tc => ({ functionCall: { name: tc.name, args: tc.args || {} } })),
        });
      } else {
        contents.push({ role: 'model', parts: [{ text: m.content || '' }] });
      }
    } else if (m.role === 'tool') {
      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name: m.tool_name, response: { result: m.content } } }],
      });
    }
  }

  const body = {
    contents,
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    tools: tools && tools.length > 0 ? [{ functionDeclarations: toolsToGeminiSchema(tools) }] : undefined,
    toolConfig: tools && tools.length > 0 ? { functionCallingConfig: { mode: 'AUTO' } } : undefined,
    generationConfig: {
      temperature: 0.4,
      topP: 0.95,
      maxOutputTokens: 8192,
    },
  };

  const url = `${GEMINI_BASE}/models/${useModel}:generateContent?key=${apiKey}`;
  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return { reply: 'Network error reaching the AI service. Try again in a moment.', tool_calls: [], input_tokens: 0, output_tokens: 0, model_used: useModel, error: 'network' };
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    return {
      reply: `The AI service returned an error (${resp.status}). The operator may need to check the API key or quota.`,
      tool_calls: [], input_tokens: 0, output_tokens: 0, model_used: useModel,
      error: 'api_error', status: resp.status, detail: text.slice(0, 500),
    };
  }

  const data = await resp.json();
  const cand = (data.candidates || [])[0];
  const parts = cand?.content?.parts || [];
  let text = '';
  const tool_calls = [];
  for (const p of parts) {
    if (typeof p.text === 'string') text += p.text;
    else if (p.functionCall) tool_calls.push({ name: p.functionCall.name, args: p.functionCall.args || {} });
  }
  const usage = data.usageMetadata || {};
  return {
    reply: text,
    tool_calls,
    input_tokens: usage.promptTokenCount || 0,
    output_tokens: usage.candidatesTokenCount || 0,
    model_used: useModel,
    finish_reason: cand?.finishReason || null,
  };
}

function toolsToGeminiSchema(tools) {
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    parameters: cleanSchema(t.parameters),
  }));
}

// Gemini's schema accepts a subset of JSON Schema. Strip enum keys we don't support, etc.
function cleanSchema(s) {
  if (!s || typeof s !== 'object') return s;
  if (Array.isArray(s)) return s.map(cleanSchema);
  const out = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === 'enum' && Array.isArray(v)) {
      out.enum = v.filter(x => typeof x === 'string');
      continue;
    }
    out[k] = cleanSchema(v);
  }
  return out;
}
