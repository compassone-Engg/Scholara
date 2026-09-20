// ProfileStore — abstract persistence for StudentProfile.
//
// Two implementations:
//   - LocalProfileStore — reads/writes localStorage (legacy / unauth fallback)
//   - SupabaseProfileStore — reads/writes the `profiles` table in Supabase
//
// Both share the same shape so AppProvider can swap implementations based on
// auth state without component-level changes.
//
// The Supabase implementation handles the camelCase ↔ snake_case mapping
// between the TS interface and the Postgres column names.

import type { SupabaseClient } from '@supabase/supabase-js';
import { StudentProfile, DEFAULT_PROFILE, APCourse, Activity, ClassRank } from '../types';

export interface ProfileStore {
  /** Load the profile (returns DEFAULT_PROFILE if none exists). */
  load(): Promise<StudentProfile>;
  /** Save the entire profile (full replace). */
  save(profile: StudentProfile): Promise<void>;
  /** Whether onboarding is complete. */
  isOnboardingComplete(): Promise<boolean>;
  /** Mark onboarding complete. */
  setOnboardingComplete(): Promise<void>;
  /** Wipe everything (used during sign-out or wipe-on-first-cloud-sign-in). */
  clear(): Promise<void>;
}

// ─── Local (legacy / unauth fallback) ────────────────────────────────────────

const PROFILE_KEY = 'scholara_profile';
const ONBOARDING_KEY = 'scholara_onboarding_complete';

export class LocalProfileStore implements ProfileStore {
  async load(): Promise<StudentProfile> {
    if (typeof window === 'undefined') return { ...DEFAULT_PROFILE };
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return { ...DEFAULT_PROFILE };
      return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_PROFILE };
    }
  }
  async save(profile: StudentProfile): Promise<void> {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch { /* quota */ }
  }
  async isOnboardingComplete(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(ONBOARDING_KEY) === 'true';
  }
  async setOnboardingComplete(): Promise<void> {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(ONBOARDING_KEY, 'true'); } catch { /* quota */ }
  }
  async clear(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(PROFILE_KEY);
      localStorage.removeItem(ONBOARDING_KEY);
    } catch { /* ignore */ }
  }
}

// ─── Supabase (cloud) ────────────────────────────────────────────────────────

// Postgres row shape for the public.profiles table.
interface ProfileRow {
  id: string;
  name: string;
  nickname: string;
  grade: number | null;
  state: string;
  high_school: string;
  gender: string;
  ethnicity: string;
  intended_major: string;
  first_gen: boolean;
  legacy_schools: string[];
  early_decision_school: string | null;
  early_action_school: string | null;
  gpa_unweighted: number | null;
  gpa_weighted: number | null;
  class_rank: ClassRank;
  sat_score: number | null;
  act_score: number | null;
  psat_score: number | null;
  ap_courses: APCourse[];
  ib_program: boolean;
  honors_count: number;
  activities: Activity[];
  awards_count: number;
  total_hours_per_week: number;
  // plan_early_decision / plan_early_action columns exist in the table but are
  // unused — the live StudentProfile model uses early_decision_school / early_action_school
  // (per-school selection) instead.
  onboarding_complete: boolean;
}

function rowToProfile(row: ProfileRow): StudentProfile {
  return {
    name: row.name,
    nickname: row.nickname,
    grade: (row.grade as 9 | 10 | 11 | 12 | null) ?? null,
    state: row.state,
    highSchool: row.high_school,
    gender: row.gender,
    ethnicity: row.ethnicity,
    intendedMajor: row.intended_major,
    firstGen: row.first_gen,
    legacySchools: row.legacy_schools ?? [],
    earlyDecisionSchool: row.early_decision_school,
    earlyActionSchool: row.early_action_school,
    gpaUnweighted: row.gpa_unweighted ?? DEFAULT_PROFILE.gpaUnweighted,
    gpaWeighted: row.gpa_weighted ?? DEFAULT_PROFILE.gpaWeighted,
    classRank: row.class_rank,
    satScore: row.sat_score,
    actScore: row.act_score,
    psatScore: row.psat_score,
    apCourses: row.ap_courses ?? [],
    ibProgram: row.ib_program,
    honorsCount: row.honors_count,
    activities: row.activities ?? [],
    awardsCount: row.awards_count,
    totalHoursPerWeek: row.total_hours_per_week,
  };
}

function profileToRow(p: StudentProfile): Omit<ProfileRow, 'id' | 'onboarding_complete'> {
  return {
    name: p.name,
    nickname: p.nickname,
    grade: p.grade,
    state: p.state,
    high_school: p.highSchool,
    gender: p.gender,
    ethnicity: p.ethnicity,
    intended_major: p.intendedMajor,
    first_gen: p.firstGen,
    legacy_schools: p.legacySchools,
    early_decision_school: p.earlyDecisionSchool,
    early_action_school: p.earlyActionSchool,
    gpa_unweighted: p.gpaUnweighted,
    gpa_weighted: p.gpaWeighted,
    class_rank: p.classRank,
    sat_score: p.satScore,
    act_score: p.actScore,
    psat_score: p.psatScore,
    ap_courses: p.apCourses,
    ib_program: p.ibProgram,
    honors_count: p.honorsCount,
    activities: p.activities,
    awards_count: p.awardsCount,
    total_hours_per_week: p.totalHoursPerWeek,
  };
}

export class SupabaseProfileStore implements ProfileStore {
  constructor(private sb: SupabaseClient, private userId: string) {}

  async load(): Promise<StudentProfile> {
    const { data, error } = await this.sb
      .from('profiles')
      .select('*')
      .eq('id', this.userId)
      .single();
    if (error || !data) {
      // The auth trigger should have created a blank row at signup. If it
      // didn't (e.g. trigger failed, or this is a legacy account), upsert one.
      await this.ensureRow();
      return { ...DEFAULT_PROFILE };
    }
    return rowToProfile(data as ProfileRow);
  }

  async save(profile: StudentProfile): Promise<void> {
    const row = { id: this.userId, ...profileToRow(profile) };
    const { error } = await this.sb.from('profiles').upsert(row, { onConflict: 'id' });
    if (error) throw error;
  }

  async isOnboardingComplete(): Promise<boolean> {
    const { data, error } = await this.sb
      .from('profiles')
      .select('onboarding_complete')
      .eq('id', this.userId)
      .single();
    if (error || !data) return false;
    return Boolean((data as { onboarding_complete: boolean }).onboarding_complete);
  }

  async setOnboardingComplete(): Promise<void> {
    const { error } = await this.sb
      .from('profiles')
      .update({ onboarding_complete: true })
      .eq('id', this.userId);
    if (error) throw error;
  }

  /**
   * Wipe — leaves the user's auth account intact but blanks the profile data.
   * In practice, "clear" during cloud mode means resetting to DEFAULT_PROFILE,
   * not deleting the row (because the trigger would re-create it anyway).
   */
  async clear(): Promise<void> {
    await this.save({ ...DEFAULT_PROFILE });
    await this.sb.from('profiles').update({ onboarding_complete: false }).eq('id', this.userId);
  }

  /**
   * Ensure a blank row exists for this user. Called when load() finds no row
   * (which means the auth trigger didn't run for some reason).
   */
  private async ensureRow(): Promise<void> {
    await this.sb.from('profiles').upsert({ id: this.userId }, { onConflict: 'id', ignoreDuplicates: true });
  }
}
