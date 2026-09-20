'use client';

import Link from 'next/link';
import { AppProvider, useApp } from './lib/context';
import HomePage from './home/HomePage';
import OnboardingFlow from './onboarding/OnboardingFlow';
import { useUser } from './lib/useAuth';
import { ScholaraWordmark } from './components/ScholaraLogo';

function Inner() {
  const { onboardingComplete } = useApp();
  if (!onboardingComplete) return <OnboardingFlow />;
  return <HomePage />;
}

/**
 * Auth gate. Three states:
 *   - Auth subsystem not configured yet (env vars missing) → render the app as-is
 *     (graceful fallback so dev/preview environments without Supabase keys still work).
 *   - Auth is loading → render a quiet loading shell.
 *   - Auth loaded, no user → render a sign-in CTA pointing at /login.
 *   - Auth loaded, user present → render the existing AppProvider tree.
 */
export default function AppShell() {
  const { user, isLoading, isAuthEnabled } = useUser();

  // Dev/preview without Supabase env: behave like the old localStorage-only app.
  if (!isAuthEnabled) {
    return (
      <AppProvider>
        <Inner />
      </AppProvider>
    );
  }

  if (isLoading) {
    return <Splash>Loading…</Splash>;
  }

  if (!user) {
    return (
      <Splash>
        <div style={{ marginBottom: 16 }}>
          <ScholaraWordmark size={22} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#F0FAFA', margin: '0 0 8px' }}>
          Sign in to continue
        </h1>
        <p style={{ fontSize: 14, color: '#7A9E9B', lineHeight: 1.5, margin: '0 0 18px' }}>
          Scholara now uses sign-in so your profile, favorites, and chat history follow you across devices.
          We&apos;ll send you a magic link — no password to remember.
        </p>
        <Link
          href="/login"
          style={{
            display: 'inline-block',
            padding: '12px 18px',
            background: '#2DD4BF',
            color: '#0A0F0E',
            borderRadius: 10,
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          Sign in with email →
        </Link>
      </Splash>
    );
  }

  return (
    <AppProvider>
      <Inner />
    </AppProvider>
  );
}

function Splash({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0A0F0E',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{ maxWidth: 360, width: '100%' }}>
        {children}
      </div>
    </div>
  );
}
