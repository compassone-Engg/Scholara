'use client';

import { StudentProfile, DEFAULT_PROFILE } from './types';

const PROFILE_KEY = 'scholara_profile';
const ONBOARDING_KEY = 'scholara_onboarding_complete';

export function saveProfile(profile: StudentProfile): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function loadProfile(): StudentProfile | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StudentProfile;
  } catch {
    return null;
  }
}

export function getProfile(): StudentProfile {
  return loadProfile() || { ...DEFAULT_PROFILE };
}

export function isOnboardingComplete(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(ONBOARDING_KEY) === 'true';
}

export function setOnboardingComplete(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ONBOARDING_KEY, 'true');
}

export function clearProfile(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(ONBOARDING_KEY);
}

// ─── Applying Schools ──────────────────────────────────────────────────────────

const APPLYING_KEY = 'scholara_applying';

export function loadApplying(): string[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(APPLYING_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function saveApplying(applying: string[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(APPLYING_KEY, JSON.stringify(applying));
}

export function toggleApplying(unitid: string): string[] {
  const current = loadApplying();
  const idx = current.indexOf(unitid);
  if (idx !== -1) {
    const next = current.filter(id => id !== unitid);
    saveApplying(next);
    return next;
  }
  const next = [...current, unitid];
  saveApplying(next);
  return next;
}

// ─── Checklist Task Completion ─────────────────────────────────────────────────

const CHECKLIST_KEY = 'scholara_checklist';

export function loadChecklistState(unitid: string): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  const raw = localStorage.getItem(`${CHECKLIST_KEY}_${unitid}`);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function saveChecklistState(unitid: string, state: Record<string, boolean>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${CHECKLIST_KEY}_${unitid}`, JSON.stringify(state));
}

export function loadAllChecklistState(): Record<string, Record<string, boolean>> {
  if (typeof window === 'undefined') return {};
  const out: Record<string, Record<string, boolean>> = {};
  const prefix = `${CHECKLIST_KEY}_`;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    const unitid = key.slice(prefix.length);
    try {
      out[unitid] = JSON.parse(localStorage.getItem(key) || '{}');
    } catch {}
  }
  return out;
}

// ─── Favorites ────────────────────────────────────────────────────────────────

const FAVORITES_KEY = 'scholara_favorites';
export const MAX_FAVORITES = 10;

export function loadFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(FAVORITES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function saveFavorites(favorites: string[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

export function toggleFavorite(unitid: string): { favorites: string[]; limitReached: boolean } {
  const current = loadFavorites();
  const idx = current.indexOf(unitid);
  if (idx !== -1) {
    const next = current.filter(id => id !== unitid);
    saveFavorites(next);
    return { favorites: next, limitReached: false };
  }
  if (current.length >= MAX_FAVORITES) {
    return { favorites: current, limitReached: true };
  }
  const next = [...current, unitid];
  saveFavorites(next);
  return { favorites: next, limitReached: false };
}
