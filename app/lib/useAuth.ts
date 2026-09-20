'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase, hasSupabaseEnv } from './supabase';

/**
 * Auth state hook. Subscribes to Supabase auth changes and exposes:
 *   - user: the current auth.user or null
 *   - session: full session object (access_token used by /api/chat etc.)
 *   - isLoading: true while the initial session check is in flight
 *   - isAuthEnabled: false until env vars are set (lets the UI hide auth)
 */
export function useUser(): {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthEnabled: boolean;
} {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isAuthEnabled = hasSupabaseEnv();

  useEffect(() => {
    if (!isAuthEnabled) {
      setIsLoading(false);
      return;
    }
    const sb = getSupabase();
    let mounted = true;

    sb.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: sub } = sb.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [isAuthEnabled]);

  return {
    user: session?.user ?? null,
    session,
    isLoading,
    isAuthEnabled,
  };
}

/**
 * Auth actions hook. Returns:
 *   - signInWithMagicLink(email)
 *   - signOut()
 *
 * Magic-link emails are sent by Supabase's built-in email service
 * (rate-limited to 100/day on the free tier — fine for the testing phase).
 */
export function useAuth() {
  const sendMagicLink = useCallback(async (email: string): Promise<{
    ok: boolean;
    error?: string;
  }> => {
    if (!hasSupabaseEnv()) {
      return { ok: false, error: 'Auth not configured yet.' };
    }
    const sb = getSupabase();
    // After clicking the magic link, Supabase redirects here. The path is
    // handled by /auth/callback which writes the session and forwards to /.
    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : undefined;
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    if (!hasSupabaseEnv()) return;
    const sb = getSupabase();
    await sb.auth.signOut();
  }, []);

  return { sendMagicLink, signOut };
}
