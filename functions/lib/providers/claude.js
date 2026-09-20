// Claude provider stub. Implement when we want to escalate hard turns.
// Same return shape as Gemini provider.

export async function runClaudeTurn({ model, system, messages, tools, env }) {
  return {
    reply: 'Claude provider is not yet implemented. Use the Gemini provider for now.',
    tool_calls: [],
    input_tokens: 0,
    output_tokens: 0,
    model_used: 'claude-not-implemented',
    placeholder: true,
  };
}
