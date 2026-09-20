// Milestone events — append-only log of meaningful state changes the student
// has earned. Schema is cloud-ready (UUID id, userId, ISO timestamps,
// structured payload) so migrating to Supabase is a backing-store swap, not a
// data reshape. NO fabricated stats — every event is computed from real state.

import { StudentProfile, APCourse, MatchResult } from './types';

// ─── Schema ──────────────────────────────────────────────────────────────────

export type MilestoneKind =
  | 'onboarding_complete'
  | 'first_favorite'
  | 'first_applying'
  | 'gpa_increase'
  | 'sat_added'
  | 'sat_increase'
  | 'act_added'
  | 'act_increase'
  | 'ap_added'
  | 'ap_good_score'
  | 'readiness_threshold'
  | 'school_category_up'
  | 'checklist_task_done'
  | 'checklist_school_done';

/**
 * Append-only event. Maps 1:1 to a future Postgres table:
 *   create table milestones (
 *     id uuid primary key,
 *     user_id uuid not null,
 *     kind text not null,
 *     key text,
 *     payload jsonb not null,
 *     created_at timestamptz not null
 *   );
 *   create unique index on milestones (user_id, kind, key) where key is not null;
 */
export interface MilestoneEvent {
  id: string;          // UUID v4, generated client-side
  userId: string;      // 'local' until auth ships
  kind: MilestoneKind;
  key?: string;        // dedup key within (userId, kind). e.g. 'readiness_70', 'school_110404_far_reach'
  payload: Record<string, unknown>; // structured data — title/emoji rendered at display time
  createdAt: string;   // ISO 8601 UTC
}

// ─── Storage (localStorage today, swap to Supabase later) ─────────────────────

const STORAGE_KEY = 'scholara_milestones';
const MAX_STORED = 500; // cap to prevent unbounded growth
const LOCAL_USER_ID = 'local'; // placeholder until auth ships

function safeGetAll(): MilestoneEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeSetAll(events: MilestoneEvent[]): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = events.length > MAX_STORED ? events.slice(-MAX_STORED) : events;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage quota or unavailable — drop silently
  }
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback if crypto.randomUUID isn't available (very old browsers)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface MilestoneStore {
  list(): MilestoneEvent[];
  hasFired(kind: MilestoneKind, key?: string): boolean;
  append(input: { kind: MilestoneKind; key?: string; payload: Record<string, unknown> }): MilestoneEvent | null;
  clear(): void;
}

/**
 * The only store implementation today. When auth ships, drop a parallel
 * `SupabaseMilestoneStore` in here and switch which one is used.
 */
export const localMilestoneStore: MilestoneStore = {
  list() {
    return safeGetAll();
  },
  hasFired(kind, key) {
    const all = safeGetAll();
    return all.some(e => e.kind === kind && (e.key ?? '') === (key ?? ''));
  },
  append(input) {
    const all = safeGetAll();
    // Dedup within (userId, kind, key) — matches the future DB unique index
    if (all.some(e => e.userId === LOCAL_USER_ID && e.kind === input.kind && (e.key ?? '') === (input.key ?? ''))) {
      return null;
    }
    const evt: MilestoneEvent = {
      id: uuid(),
      userId: LOCAL_USER_ID,
      kind: input.kind,
      key: input.key,
      payload: input.payload,
      createdAt: new Date().toISOString(),
    };
    safeSetAll([...all, evt]);
    return evt;
  },
  clear() {
    safeSetAll([]);
  },
};

// ─── Detection ───────────────────────────────────────────────────────────────

const READINESS_THRESHOLDS = [50, 60, 70, 80, 90];

export interface MilestoneInputs {
  profile: StudentProfile;
  prevProfile: StudentProfile | null;
  matchResults: MatchResult[];
  prevMatchResults: MatchResult[] | null;
  readinessScore: number;
  prevReadinessScore: number | null;
  favorites: string[];
  applying: string[];
  checklistProgress: Record<string, Record<string, boolean>>;
  prevChecklistProgress: Record<string, Record<string, boolean>> | null;
  onboardingComplete: boolean;
  prevOnboardingComplete: boolean | null;
  // Total task count per school (for "all tasks done" detection)
  totalTasksByUnitid: Record<string, number>;
}

/**
 * Pure function — compares prev state to current and returns events that
 * should be APPENDED if not already in the store. Caller calls store.append()
 * which dedupes. Safe to call on every render.
 */
export function detectMilestones(s: MilestoneInputs, store: MilestoneStore): MilestoneEvent[] {
  const newly: MilestoneEvent[] = [];
  const tryAppend = (kind: MilestoneKind, key: string | undefined, payload: Record<string, unknown>) => {
    if (store.hasFired(kind, key)) return;
    const evt = store.append({ kind, key, payload });
    if (evt) newly.push(evt);
  };

  // Onboarding complete (fires once)
  if (s.onboardingComplete && !s.prevOnboardingComplete) {
    tryAppend('onboarding_complete', undefined, {});
  }

  // First favorite (fires once)
  if (s.favorites.length > 0) {
    tryAppend('first_favorite', undefined, { count: s.favorites.length });
  }

  // First applying (fires once)
  if (s.applying.length > 0) {
    tryAppend('first_applying', undefined, { count: s.applying.length });
  }

  // GPA increase: fire when GPA increases by ≥0.1 (keyed by the new rounded GPA so it fires once per .1-step)
  if (s.prevProfile && s.profile.gpaUnweighted && s.prevProfile.gpaUnweighted) {
    const cur = s.profile.gpaUnweighted;
    const prev = s.prevProfile.gpaUnweighted;
    if (cur - prev >= 0.1) {
      const stepKey = (Math.round(cur * 10) / 10).toFixed(1);
      tryAppend('gpa_increase', stepKey, { current: cur, previous: prev });
    }
  }

  // SAT added (first time)
  if (s.profile.satScore && s.profile.satScore > 400) {
    tryAppend('sat_added', undefined, { score: s.profile.satScore });
    if (s.prevProfile?.satScore && s.profile.satScore - s.prevProfile.satScore >= 30) {
      tryAppend('sat_increase', String(s.profile.satScore), { current: s.profile.satScore, previous: s.prevProfile.satScore });
    }
  }

  // ACT added (first time)
  if (s.profile.actScore && s.profile.actScore > 1) {
    tryAppend('act_added', undefined, { score: s.profile.actScore });
    if (s.prevProfile?.actScore && s.profile.actScore - s.prevProfile.actScore >= 1) {
      tryAppend('act_increase', String(s.profile.actScore), { current: s.profile.actScore, previous: s.prevProfile.actScore });
    }
  }

  // AP added — one event per AP course name
  if (s.prevProfile) {
    const prevNames = new Set(s.prevProfile.apCourses.map(c => c.name));
    for (const c of s.profile.apCourses) {
      if (!prevNames.has(c.name)) {
        tryAppend('ap_added', c.name, { courseName: c.name });
      }
    }
    // AP good score (4 or 5)
    const prevScored: Record<string, number | null> = {};
    for (const c of s.prevProfile.apCourses) prevScored[c.name] = c.score;
    for (const c of s.profile.apCourses) {
      if (c.score && c.score >= 4 && prevScored[c.name] !== c.score) {
        tryAppend('ap_good_score', `${c.name}_${c.score}`, { courseName: c.name, score: c.score });
      }
    }
  }

  // Readiness threshold crossed
  if (s.prevReadinessScore !== null) {
    for (const thresh of READINESS_THRESHOLDS) {
      if (s.readinessScore >= thresh && s.prevReadinessScore < thresh) {
        tryAppend('readiness_threshold', String(thresh), { threshold: thresh, score: s.readinessScore });
      }
    }
  }

  // School moved up a category (far_reach → reach → match → safety)
  if (s.prevMatchResults) {
    const prevByUnitid = new Map<string, MatchResult>();
    for (const r of s.prevMatchResults) prevByUnitid.set(r.schoolUnitid, r);
    const order = { far_reach: 0, reach: 1, match: 2, safety: 3 };
    for (const r of s.matchResults) {
      const prev = prevByUnitid.get(r.schoolUnitid);
      if (!prev) continue;
      const curRank = order[r.matchCategory];
      const prevRank = order[prev.matchCategory];
      if (curRank > prevRank) {
        // Key includes from→to so the user can rise again from a different starting point later
        const key = `${r.schoolUnitid}_${prev.matchCategory}_to_${r.matchCategory}`;
        tryAppend('school_category_up', key, {
          unitid: r.schoolUnitid,
          from: prev.matchCategory,
          to: r.matchCategory,
        });
      }
    }
  }

  // Checklist task completed
  if (s.prevChecklistProgress) {
    for (const [unitid, taskMap] of Object.entries(s.checklistProgress)) {
      const prevMap = s.prevChecklistProgress[unitid] ?? {};
      for (const [taskId, done] of Object.entries(taskMap)) {
        if (done && !prevMap[taskId]) {
          tryAppend('checklist_task_done', `${unitid}_${taskId}`, { unitid, taskId });
        }
      }
      // School checklist complete
      const total = s.totalTasksByUnitid[unitid];
      if (total && total > 0) {
        const doneCount = Object.values(taskMap).filter(Boolean).length;
        if (doneCount >= total) {
          tryAppend('checklist_school_done', unitid, { unitid, totalTasks: total });
        }
      }
    }
  }

  return newly;
}

// ─── Rendering (kept separate from storage so emoji/copy can change without backfilling) ─

const CATEGORY_LABEL: Record<string, string> = {
  safety: 'Safety',
  match: 'Match',
  reach: 'Reach',
  far_reach: 'Far Reach',
};

export interface RenderedMilestone {
  emoji: string;
  title: string;
  subtitle?: string;
}

/**
 * Given an event and optional helpers, return the user-facing strings.
 * `schoolNameFor(unitid)` is provided so the renderer doesn't need to know
 * about the schools array (decoupling).
 */
export function renderMilestone(
  event: MilestoneEvent,
  helpers: { schoolNameFor?: (unitid: string) => string | null } = {}
): RenderedMilestone {
  const p = event.payload;
  switch (event.kind) {
    case 'onboarding_complete':
      return { emoji: '🎯', title: 'Profile complete', subtitle: 'Your match scores are live across all 60 schools.' };
    case 'first_favorite':
      return { emoji: '⭐', title: 'First favorite added' };
    case 'first_applying':
      return { emoji: '✅', title: 'Application list started' };
    case 'gpa_increase':
      return { emoji: '📈', title: `GPA up to ${(p.current as number).toFixed(2)}`, subtitle: `from ${(p.previous as number).toFixed(2)}` };
    case 'sat_added':
      return { emoji: '📝', title: `SAT recorded: ${p.score}` };
    case 'sat_increase':
      return { emoji: '📈', title: `SAT up to ${p.current}`, subtitle: `from ${p.previous}` };
    case 'act_added':
      return { emoji: '📝', title: `ACT recorded: ${p.score}` };
    case 'act_increase':
      return { emoji: '📈', title: `ACT up to ${p.current}`, subtitle: `from ${p.previous}` };
    case 'ap_added':
      return { emoji: '📚', title: `${p.courseName} added to your plan` };
    case 'ap_good_score':
      return { emoji: '🏆', title: `${p.score} on ${p.courseName}`, subtitle: 'That counts as quality rigor.' };
    case 'readiness_threshold':
      return { emoji: '🚀', title: `Readiness hit ${p.threshold}` };
    case 'school_category_up': {
      const name = helpers.schoolNameFor?.(p.unitid as string) ?? 'A school';
      return {
        emoji: '🎯',
        title: `${name} is now a ${CATEGORY_LABEL[p.to as string]}`,
        subtitle: `Was ${CATEGORY_LABEL[p.from as string]}`,
      };
    }
    case 'checklist_task_done': {
      const name = helpers.schoolNameFor?.(p.unitid as string) ?? 'A school';
      return { emoji: '✓', title: `Task done at ${name}` };
    }
    case 'checklist_school_done': {
      const name = helpers.schoolNameFor?.(p.unitid as string) ?? 'A school';
      return { emoji: '🎉', title: `${name} checklist complete!`, subtitle: `All ${p.totalTasks} tasks done.` };
    }
    default:
      return { emoji: '✨', title: 'Milestone' };
  }
}
