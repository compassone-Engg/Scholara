'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { StudentProfile, MatchResult, DEFAULT_PROFILE } from './types';
import { calculateAllMatches, calcReadinessScore, generateTopTip } from './algorithm';
import { track, gpaBand, satBand, actBand, countBand } from './events';
import schoolsData from '../../data/schools.json';
import { School } from './types';
import MilestoneToast from '../components/MilestoneToast';
import { useUser } from './useAuth';
import { getSupabase } from './supabase';
import { LocalProfileStore, SupabaseProfileStore, ProfileStore } from './store/profileStore';

const schools = schoolsData as School[];

// One-time wipe of legacy `scholara_*` localStorage keys on the first cloud
// sign-in (option B in the migration plan — start fresh, don't import).
// We keep the supabase auth storage key and a flag tracking that the wipe ran.
const CLOUD_MIGRATION_FLAG = 'scholara_cloud_migration_done';

function wipeLegacyLocalStorageOnce(): void {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(CLOUD_MIGRATION_FLAG)) return;
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (!k.startsWith('scholara_')) continue;
    if (k === 'scholara_supabase_auth') continue;
    if (k === CLOUD_MIGRATION_FLAG) continue;
    toRemove.push(k);
  }
  for (const k of toRemove) localStorage.removeItem(k);
  localStorage.setItem(CLOUD_MIGRATION_FLAG, new Date().toISOString());
}

interface AppContextType {
  profile: StudentProfile;
  updateProfile: (updates: Partial<StudentProfile>) => void;
  matchResults: MatchResult[];
  readinessScore: number;
  topTip: string;
  onboardingComplete: boolean;
  completeOnboarding: (profile: StudentProfile) => void;
  schools: School[];
  isCalculating: boolean;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthEnabled } = useUser();

  // Pick the right ProfileStore based on auth state.
  // Memoized so we don't churn during re-renders.
  const store: ProfileStore = useMemo(() => {
    if (isAuthEnabled && user) {
      return new SupabaseProfileStore(getSupabase(), user.id);
    }
    return new LocalProfileStore();
  }, [isAuthEnabled, user]);

  const [profile, setProfile] = useState<StudentProfile>({ ...DEFAULT_PROFILE });
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [readinessScore, setReadinessScore] = useState(0);
  const [topTip, setTopTip] = useState('');
  const [onboardingComplete, setOnboardingDone] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const calcDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackedSessionRef = useRef(false);

  // Load profile + onboarding flag from the current store on mount and
  // whenever the store changes (e.g. user signs in or out).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // On first cloud sign-in, wipe legacy localStorage so the user starts
      // from a clean slate (no import).
      if (isAuthEnabled && user) wipeLegacyLocalStorageOnce();
      try {
        const [loaded, onbDone] = await Promise.all([
          store.load(),
          store.isOnboardingComplete(),
        ]);
        if (cancelled) return;
        setProfile(loaded);
        setOnboardingDone(onbDone);
        if (!trackedSessionRef.current) {
          trackedSessionRef.current = true;
          track('app_session_start', {
            onboarded: onbDone,
            has_profile: Boolean(loaded.name),
            auth_mode: isAuthEnabled && user ? 'cloud' : 'local',
          });
        }
      } catch (err) {
        console.error('Profile load failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [store, isAuthEnabled, user]);

  // Recalculate match results (debounced) whenever profile changes
  const recalculate = useCallback((p: StudentProfile) => {
    if (calcDebounceRef.current) clearTimeout(calcDebounceRef.current);
    setIsCalculating(true);
    calcDebounceRef.current = setTimeout(() => {
      const results = calculateAllMatches(p, schools);
      const score = calcReadinessScore(p, schools);
      const tip = generateTopTip(p, schools);
      setMatchResults(results);
      setReadinessScore(score);
      setTopTip(tip);
      setIsCalculating(false);
    }, 100);
  }, []);

  useEffect(() => {
    recalculate(profile);
  }, [profile, recalculate]);

  // Persist profile to store (debounced write to avoid hammering Supabase
  // while a slider is being dragged).
  const persistProfile = useCallback((next: StudentProfile) => {
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(() => {
      store.save(next).catch(err => console.error('Profile save failed:', err));
    }, 400);
  }, [store]);

  const updateProfile = useCallback((updates: Partial<StudentProfile>) => {
    setProfile(prev => {
      const next = { ...prev, ...updates };
      persistProfile(next);
      return next;
    });
  }, [persistProfile]);

  const completeOnboarding = useCallback((p: StudentProfile) => {
    setProfile(p);
    setOnboardingDone(true);
    // Fire-and-forget. The user can't actively block on this and the toast
    // / next page will work fine with in-memory state.
    (async () => {
      try {
        await store.save(p);
        await store.setOnboardingComplete();
      } catch (err) {
        console.error('Onboarding save failed:', err);
      }
    })();
    track('onboarding_completed', {
      gpa_band: gpaBand(p.gpaUnweighted),
      sat_band: satBand(p.satScore),
      act_band: actBand(p.actScore),
      ap_count_band: countBand(p.apCourses?.length),
      activities_count_band: countBand(p.activities?.length),
      ib_program: !!p.ibProgram,
      first_gen: !!p.firstGen,
      legacy_count_band: countBand(p.legacySchools?.length, [1, 2, 3]),
    });
  }, [store]);

  return (
    <AppContext.Provider value={{
      profile,
      updateProfile,
      matchResults,
      readinessScore,
      topTip,
      onboardingComplete,
      completeOnboarding,
      schools,
      isCalculating,
    }}>
      {children}
      {onboardingComplete && <MilestoneToast />}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
