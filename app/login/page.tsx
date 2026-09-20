'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth, useUser } from '../lib/useAuth';
import { ScholaraWordmark } from '../components/ScholaraLogo';

export default function LoginPage() {
  const { sendMagicLink } = useAuth();
  const { user, isAuthEnabled } = useUser();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'sent' | 'error'; message?: string }>({ kind: 'idle' });

  // If auth env isn't set up yet, show a clear message instead of a broken form.
  if (!isAuthEnabled) {
    return (
      <Centered>
        <Title>Sign-in not yet configured</Title>
        <Body>The team is wiring up Supabase auth. Check back shortly.</Body>
      </Centered>
    );
  }

  // Already signed in → bounce to home.
  if (user) {
    return (
      <Centered>
        <Title>You&apos;re signed in</Title>
        <Body>Signed in as {user.email}.</Body>
        <Link href="/" style={linkBtn}>Continue →</Link>
      </Centered>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setStatus({ kind: 'idle' });
    const res = await sendMagicLink(email);
    setSubmitting(false);
    if (res.ok) setStatus({ kind: 'sent' });
    else setStatus({ kind: 'error', message: res.error || 'Something went wrong.' });
  };

  return (
    <Centered>
      <div style={{ marginBottom: 18 }}>
        <ScholaraWordmark size={22} />
      </div>
      <Title>Sign in to Scholara</Title>
      <Body>
        We&apos;ll email you a magic link. Tap it from your inbox and you&apos;re in — no password to remember.
      </Body>

      {status.kind === 'sent' ? (
        <div style={{
          background: '#1A4540',
          border: '1px solid #2DD4BF55',
          borderRadius: 12,
          padding: '14px 16px',
          marginTop: 16,
        }}>
          <div style={{ fontSize: 14, color: '#F0FAFA', fontWeight: 600, marginBottom: 4 }}>
            📬 Check your email
          </div>
          <div style={{ fontSize: 12, color: '#7A9E9B', lineHeight: 1.5 }}>
            We sent a link to <strong style={{ color: '#F0FAFA' }}>{email}</strong>. The link expires in 1 hour.
            Don&apos;t see it? Check spam — it&apos;ll come from a Supabase address until we move to a custom sender.
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} style={{ marginTop: 16 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#7A9E9B', marginBottom: 8 }}>
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@school.edu"
            required
            autoFocus
            autoComplete="email"
            style={{
              width: '100%',
              padding: '12px 14px',
              background: '#162220',
              border: '1px solid #1E302E',
              borderRadius: 10,
              color: '#F0FAFA',
              fontSize: 15,
              outline: 'none',
              marginBottom: 12,
            }}
          />
          <button
            type="submit"
            disabled={submitting || !email.trim()}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: submitting || !email.trim() ? '#1E302E' : '#2DD4BF',
              color: submitting || !email.trim() ? '#4A6560' : '#0A0F0E',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: submitting || !email.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Sending…' : 'Send magic link'}
          </button>
          {status.kind === 'error' && (
            <div style={{ marginTop: 12, fontSize: 12, color: '#F87171' }}>{status.message}</div>
          )}
        </form>
      )}
    </Centered>
  );
}

// ─── Layout helpers ─────────────────────────────────────────────────────────

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0A0F0E',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{ maxWidth: 380, width: '100%' }}>{children}</div>
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <h1 style={{
      fontSize: 22,
      fontWeight: 800,
      color: '#F0FAFA',
      margin: '0 0 8px',
    }}>
      {children}
    </h1>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 14,
      color: '#7A9E9B',
      lineHeight: 1.5,
      margin: 0,
    }}>
      {children}
    </p>
  );
}

const linkBtn: React.CSSProperties = {
  display: 'inline-block',
  marginTop: 14,
  padding: '10px 14px',
  background: '#2DD4BF',
  color: '#0A0F0E',
  borderRadius: 10,
  textDecoration: 'none',
  fontSize: 14,
  fontWeight: 700,
};
