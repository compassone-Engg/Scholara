'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase, hasSupabaseEnv } from '../../lib/supabase';

/**
 * Magic-link callback. Supabase's `detectSessionInUrl` reads the access_token
 * fragment off the URL and writes the session to storage automatically — we
 * just need to wait for it and forward to the home page.
 *
 * If the user lands here without a valid token (e.g. expired link), we route
 * them back to /login with an error.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabaseEnv()) {
      setError('Auth not configured yet.');
      return;
    }
    let cancelled = false;
    const sb = getSupabase();

    // detectSessionInUrl runs once the client is created; we poll briefly for
    // the resulting session, then forward.
    const start = Date.now();
    const check = async () => {
      if (cancelled) return;
      const { data } = await sb.auth.getSession();
      if (data.session) {
        router.replace('/');
        return;
      }
      if (Date.now() - start > 5000) {
        setError('Magic link expired or invalid. Try requesting a new one.');
        return;
      }
      setTimeout(check, 200);
    };
    check();
    return () => { cancelled = true; };
  }, [router]);

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0A0F0E',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{ maxWidth: 360, width: '100%', textAlign: 'center' }}>
        {error ? (
          <>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#F87171', marginBottom: 8 }}>
              Sign-in failed
            </div>
            <div style={{ fontSize: 13, color: '#7A9E9B', marginBottom: 18 }}>{error}</div>
            <a
              href="/login"
              style={{
                display: 'inline-block',
                padding: '10px 14px',
                background: '#2DD4BF',
                color: '#0A0F0E',
                borderRadius: 10,
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              Back to sign in
            </a>
          </>
        ) : (
          <>
            <div style={{ fontSize: 18, color: '#F0FAFA', marginBottom: 8 }}>Signing you in…</div>
            <div style={{ fontSize: 12, color: '#7A9E9B' }}>One moment.</div>
          </>
        )}
      </div>
    </div>
  );
}
