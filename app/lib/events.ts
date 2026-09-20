'use client';

// Phase 1 anonymized event tracking. Generates a per-browser pseudonymous_id
// (UUID, stored in localStorage) and POSTs batched events to /api/events.
// Honors a localStorage opt-out flag. Never sends PII — payloads should be
// bucketed/categorical, not raw values.

const PSEUDO_ID_KEY = 'scholara_pseudo_id';
const OPTOUT_KEY = 'scholara_analytics_optout';
const APP_VERSION = '0.1.0-phase1';
const FLUSH_DELAY_MS = 1500;
const MAX_QUEUE = 50;

type EventRecord = {
  id: string;
  pseudonymous_id: string;
  event_type: string;
  payload: string | null;
  app_version: string;
  client_timestamp: number;
};

let queue: EventRecord[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let visibilityHookInstalled = false;

function safeRandomId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
  } catch {}
  return 'ev-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getPseudoId(): string {
  if (typeof window === 'undefined') return '';
  let id: string | null = null;
  try {
    id = localStorage.getItem(PSEUDO_ID_KEY);
  } catch {
    return '';
  }
  if (!id) {
    id = safeRandomId();
    try { localStorage.setItem(PSEUDO_ID_KEY, id); } catch {}
  }
  return id;
}

export function isOptedOut(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(OPTOUT_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setOptedOut(opted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (opted) localStorage.setItem(OPTOUT_KEY, 'true');
    else localStorage.removeItem(OPTOUT_KEY);
  } catch {}
  if (opted) {
    queue = [];
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  }
}

function installVisibilityHook() {
  if (visibilityHookInstalled || typeof document === 'undefined') return;
  visibilityHookInstalled = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flush();
    }
  });
  window.addEventListener('pagehide', () => flush());
}

export function track(eventType: string, payload?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  if (isOptedOut()) return;
  installVisibilityHook();
  const pseudo = getPseudoId();
  if (!pseudo) return;
  queue.push({
    id: safeRandomId(),
    pseudonymous_id: pseudo,
    event_type: eventType,
    payload: payload ? JSON.stringify(payload) : null,
    app_version: APP_VERSION,
    client_timestamp: Date.now(),
  });
  if (queue.length >= MAX_QUEUE) {
    flush();
    return;
  }
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
}

export async function flush(): Promise<void> {
  if (queue.length === 0) return;
  const batch = queue.splice(0);
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  try {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
      credentials: 'same-origin',
      keepalive: true,
    });
  } catch {
    // Drop the batch silently — analytics must not break the app.
  }
}

// ─── Bucketing helpers ─────────────────────────────────────────────
// Use these in event payloads instead of raw user values.

export function gpaBand(gpa: number | null | undefined): string {
  if (!Number.isFinite(gpa as number)) return 'unknown';
  const g = gpa as number;
  if (g >= 4.0) return '>=4.0';
  if (g >= 3.75) return '3.75-4.0';
  if (g >= 3.5)  return '3.5-3.74';
  if (g >= 3.25) return '3.25-3.49';
  if (g >= 3.0)  return '3.0-3.24';
  if (g >= 2.5)  return '2.5-2.99';
  return '<2.5';
}

export function satBand(sat: number | null | undefined): string {
  if (!Number.isFinite(sat as number) || (sat as number) < 400) return 'none';
  const s = sat as number;
  if (s >= 1500) return '1500+';
  if (s >= 1400) return '1400-1499';
  if (s >= 1300) return '1300-1399';
  if (s >= 1200) return '1200-1299';
  if (s >= 1100) return '1100-1199';
  return '<1100';
}

export function actBand(act: number | null | undefined): string {
  if (!Number.isFinite(act as number) || (act as number) < 1) return 'none';
  const a = act as number;
  if (a >= 34) return '34-36';
  if (a >= 30) return '30-33';
  if (a >= 26) return '26-29';
  if (a >= 22) return '22-25';
  return '<22';
}

export function countBand(n: number | null | undefined, breaks = [1, 3, 5, 8, 12]): string {
  const v = Number(n) || 0;
  let prev = 0;
  for (const b of breaks) {
    if (v < b) return prev === 0 ? `<${b}` : `${prev}-${b - 1}`;
    prev = b;
  }
  return `${prev}+`;
}
