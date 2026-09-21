'use client';

import { AppProvider, useApp } from './lib/context';
import HomePage from './home/HomePage';
import OnboardingFlow from './onboarding/OnboardingFlow';

function Inner() {
  const { onboardingComplete } = useApp();
  if (!onboardingComplete) return <OnboardingFlow />;
  return <HomePage />;
}

/**
 * Temporary QA shell: bypass authentication on this test-only branch.
 * AppProvider will use its unauthenticated/local profile store, allowing the
 * onboarding UI to be exercised without consuming Supabase magic-link quota.
 */
export default function AppShell() {
  return (
    <AppProvider>
      <Inner />
    </AppProvider>
  );
}
