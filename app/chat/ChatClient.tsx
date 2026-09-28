'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../lib/context';
import BottomNav from '../components/BottomNav';
import { GraduationCap } from '../components/ScholaraLogo';
import { getPseudoId, track } from '../lib/events';
import { useFavorites } from '../lib/useFavorites';
import { useApplying } from '../lib/useApplying';

type ChatMsg = { role: 'user' | 'assistant'; content: string; toolsUsed?: string[]; isPlaceholder?: boolean };

const STORAGE_KEY = 'scholara_chat_history';
const CONVERSATION_ID_KEY = 'scholara_chat_conversation_id';
const MAX_INPUT = 1500;

const SUGGESTIONS = [
  'Is my school list balanced?',
  "What would move my chances at UCLA?",
  'Should I apply ED somewhere?',
  'Pick 5 schools I should focus on.',
  "I'm worried I'm behind. Am I?",
];

function loadHistory(): ChatMsg[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-40) : [];
  } catch { return []; }
}

function saveHistory(msgs: ChatMsg[]) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-40))); } catch {}
}

function getConversationId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(CONVERSATION_ID_KEY);
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) || 'conv-' + Date.now();
    try { localStorage.setItem(CONVERSATION_ID_KEY, id); } catch {}
  }
  return id;
}

export default function ChatClient() {
  const { profile, onboardingComplete } = useApp();
  const { favorites } = useFavorites();
  const { applying } = useApplying();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(loadHistory());
    track('chat_opened');
    // Pre-fill input from ?prompt= query param so jump-off cards can deep-link
    // into specific counselor questions. We don't auto-send — the user reviews
    // and taps Send. URL is then cleaned so a refresh doesn't re-pre-fill.
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const p = params.get('prompt');
      if (p) {
        setInput(p.slice(0, MAX_INPUT));
        const url = new URL(window.location.href);
        url.searchParams.delete('prompt');
        window.history.replaceState({}, '', url.pathname + (url.search || ''));
      }
    }
  }, []);

  useEffect(() => {
    saveHistory(messages);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    if (trimmed.length > MAX_INPUT) {
      setError(`Message too long (${trimmed.length}/${MAX_INPUT}).`);
      return;
    }
    setError(null);
    setInput('');

    const newUserMsg: ChatMsg = { role: 'user', content: trimmed };
    const nextMessages = [...messages, newUserMsg];
    setMessages(nextMessages);
    setSending(true);
    try { localStorage.setItem('scholara_chat_last_ts', String(Date.now())); } catch {}
    track('chat_message_sent', { length_band: trimmed.length < 50 ? '<50' : trimmed.length < 200 ? '50-200' : '>200' });

    try {
      const conversationId = getConversationId();
      const pseudoId = getPseudoId();
      const apiMessages = nextMessages.map(m => ({ role: m.role, content: m.content }));

      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          conversation_id: conversationId,
          pseudonymous_id: pseudoId,
          profile,
          applying,
          favorites,
          messages: apiMessages,
        }),
      });

      if (resp.status === 429) {
        const data = await resp.json().catch(() => ({}));
        setError(`You've reached the daily message limit (${data.cap || 30}). Try again tomorrow.`);
        track('chat_rate_limited');
        setSending(false);
        return;
      }

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        setError(`The counselor service had an error (${resp.status}). Try again in a moment.`);
        track('chat_error', { status: resp.status });
        setSending(false);
        return;
      }

      const data = await resp.json();
      const assistantMsg: ChatMsg = {
        role: 'assistant',
        content: data.reply || '(empty reply)',
        toolsUsed: Array.isArray(data.tool_calls_used) ? data.tool_calls_used : [],
        isPlaceholder: !!data.placeholder,
      };
      setMessages(m => [...m, assistantMsg]);
      track('chat_message_received', { tools_count: assistantMsg.toolsUsed?.length || 0, placeholder: assistantMsg.isPlaceholder });
    } catch (err) {
      setError('Network error. Try again.');
      track('chat_network_error');
    } finally {
      setSending(false);
    }
  }, [messages, profile, sending, applying, favorites]);

  const clearHistory = () => {
    if (!confirm('Clear this conversation?')) return;
    setMessages([]);
    saveHistory([]);
    try { localStorage.removeItem(CONVERSATION_ID_KEY); } catch {}
    track('chat_cleared');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0A0F0E',
      color: '#F0FAFA',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        padding: '14px 20px',
        paddingTop: 'max(14px, env(safe-area-inset-top))',
        background: 'rgba(10,15,14,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #1E302E',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <GraduationCap size={22} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Counselor</div>
            <div style={{ fontSize: 11, color: '#7A9E9B' }}>AI assistant</div>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearHistory}
            style={{ background: 'none', border: '1px solid #1E302E', color: '#7A9E9B', fontSize: 11, padding: '5px 10px', borderRadius: 6, cursor: 'pointer' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 16px 100px',
      }}>
        {messages.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, color: '#F0FAFA', marginBottom: 8 }}>
              Hi. I'm your counselor.
            </div>
            <div style={{ fontSize: 13, color: '#7A9E9B', lineHeight: 1.6, marginBottom: 24, maxWidth: 320, margin: '0 auto 24px' }}>
              Ask about your school list, your chances, deadlines, or strategy. I'll use your actual profile and the algorithm — never guess.
              {!onboardingComplete && (
                <div style={{ marginTop: 12, fontSize: 12, color: '#FACC15' }}>
                  Heads up: you haven't finished onboarding, so I won't have your profile to work with yet.
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360, margin: '0 auto' }}>
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={sending}
                  style={{
                    background: '#111918',
                    border: '1px solid #1E302E',
                    color: '#F0FAFA',
                    padding: '12px 16px',
                    borderRadius: 12,
                    textAlign: 'left',
                    fontSize: 14,
                    cursor: sending ? 'not-allowed' : 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseOver={e => { (e.currentTarget.style.background = '#162220'); }}
                  onMouseOut={e => { (e.currentTarget.style.background = '#111918'); }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <Message key={i} msg={m} />
        ))}

        {sending && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '8px 4px' }}>
            <div style={{
              padding: '10px 14px',
              background: '#111918',
              border: '1px solid #1E302E',
              borderRadius: 14,
              fontSize: 13,
              color: '#7A9E9B',
            }}>
              <span className="dot" /> <span className="dot" /> <span className="dot" />
            </div>
          </div>
        )}

        {error && (
          <div style={{
            margin: '12px 4px',
            padding: '10px 14px',
            background: 'rgba(248,113,113,0.08)',
            border: '1px solid rgba(248,113,113,0.25)',
            borderRadius: 10,
            fontSize: 13,
            color: '#F87171',
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          maxWidth: 500,
          margin: '0 auto',
          padding: '10px 12px',
          paddingBottom: 'max(60px, calc(env(safe-area-inset-bottom) + 60px))',
          background: 'linear-gradient(to top, #0A0F0E 70%, rgba(10,15,14,0.0))',
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value.slice(0, MAX_INPUT))}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask about your list, chances, or strategy…"
            rows={1}
            style={{
              flex: 1,
              background: '#111918',
              border: '1px solid #1E302E',
              borderRadius: 14,
              color: '#F0FAFA',
              padding: '12px 14px',
              fontSize: 14,
              fontFamily: 'inherit',
              outline: 'none',
              resize: 'none',
              minHeight: 44,
              maxHeight: 120,
            }}
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            style={{
              background: input.trim() && !sending ? 'linear-gradient(135deg, #2DD4BF, #0D9488)' : '#1E302E',
              border: 'none',
              color: input.trim() && !sending ? '#0A0F0E' : '#4A6560',
              fontSize: 14,
              fontWeight: 700,
              padding: '0 18px',
              minHeight: 44,
              borderRadius: 14,
              cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
            }}
          >
            Send
          </button>
        </div>
      </form>

      <BottomNav />

      <style jsx>{`
        .dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          margin: 0 2px;
          background: #4A6560;
          border-radius: 50%;
          animation: pulse 1.2s infinite ease-in-out;
        }
        .dot:nth-child(2) { animation-delay: 0.15s; }
        .dot:nth-child(3) { animation-delay: 0.3s; }
        @keyframes pulse {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function Message({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', padding: '6px 0' }}>
      <div style={{
        maxWidth: '88%',
        padding: '10px 14px',
        background: isUser ? '#1A4540' : '#111918',
        border: isUser ? '1px solid #2DD4BF44' : '1px solid #1E302E',
        borderRadius: 14,
        fontSize: 14,
        lineHeight: 1.55,
        color: isUser ? '#F0FAFA' : '#F0FAFA',
        whiteSpace: 'pre-wrap',
      }}>
        {msg.content}
        {msg.isPlaceholder && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#FACC15' }}>
            (Configuration pending — operator needs to set the API key.)
          </div>
        )}
      </div>
    </div>
  );
}
