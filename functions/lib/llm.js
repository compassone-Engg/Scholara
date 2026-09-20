// Provider-agnostic chat interface. Today: Gemini. Easy to swap.
//
// runChatTurn({ provider, model, system, messages, tools, env }) ->
//   { reply, tool_calls, input_tokens, output_tokens, model_used }
//
// `messages` is in this normalized shape:
//   [{ role: 'user' | 'assistant', content: string }, ...]
// Tool-call turns are represented as:
//   { role: 'assistant', tool_calls: [{ name, args }] }
// Tool results going back in:
//   { role: 'tool', tool_name, content }

import { runGeminiTurn } from './providers/gemini.js';
import { runClaudeTurn } from './providers/claude.js';

export async function runChatTurn(opts) {
  const provider = opts.provider || 'gemini';
  if (provider === 'gemini') return runGeminiTurn(opts);
  if (provider === 'claude') return runClaudeTurn(opts);
  throw new Error(`unknown_provider:${provider}`);
}
