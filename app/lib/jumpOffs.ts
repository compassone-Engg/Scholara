// Contextual home page rules engine.
//
// Each rule is a pure function that takes a normalized State and returns 0+
// candidate JumpOff cards with a priority score. computeJumpOffs() runs all
// rules, sorts by priority desc, and returns the top 5.
//
// To add a new rule: write a function that returns JumpOff[], then add it
// to the RULES array. Cards COMPETE for the 5 slots — high-priority rules
// push lower ones off-screen, which is the design.

import { StudentProfile, MatchResult, School } from './types';

export type JumpOffIcon =
  | 'deadline' | 'chat' | 'task' | 'discover' | 'profile' | 'finance' | 'methodology';
export type JumpOffUrgency = 'red' | 'yellow' | 'green';

export interface JumpOff {
  id: string;
  title: string;
  subtitle?: string;
  icon: JumpOffIcon;
  urgency: JumpOffUrgency;
  priority: number;
  href: string;
}

interface ChecklistData {
  platform: string;
  platformUrl: string;
  deadlines: Record<string, string>;
  tasks: Array<{ id: string; title: string; category: string; description: string; dueDate: string; estimatedMinutes: number }>;
}

export interface JumpOffState {
  profile: StudentProfile;
  applying: string[];
  favorites: string[];
  matchResults: MatchResult[];
  schools: School[];
  checklists: Record<string, ChecklistData>;
  checklistProgress: Record<string, Record<string, boolean>>;
  onboardingComplete: boolean;
  now: Date;
  chatActivity: {
    hasEverChatted: boolean;
    lastMessageTs: number | null;
  };
}

export function computeJumpOffs(s: JumpOffState, limit = 5): JumpOff[] {
  const candidates: JumpOff[] = [];
  for (const rule of RULES) {
    candidates.push(...rule(s));
  }
  candidates.sort((a, b) => b.priority - a.priority);
  return candidates.slice(0, limit);
}

// ─── Helpers ──────────────────────────────────────────────────────

function daysUntil(dateStr: string | null | undefined, now: Date): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function findSchool(s: JumpOffState, unitid: string): School | undefined {
  return s.schools.find(x => x.unitid === unitid);
}

function checklistFor(s: JumpOffState, unitid: string): ChecklistData | undefined {
  if (s.checklists[unitid]) return s.checklists[unitid];
  const school = findSchool(s, unitid);
  const key = (school as unknown as { policy?: { checklist_key?: string } } | undefined)?.policy?.checklist_key;
  if (key && s.checklists[key]) return s.checklists[key];
  return s.checklists['common_app_template'];
}

function progressFor(s: JumpOffState, unitid: string): { done: number; total: number } {
  const cl = checklistFor(s, unitid);
  if (!cl) return { done: 0, total: 0 };
  const map = s.checklistProgress[unitid] || {};
  const done = Object.values(map).filter(Boolean).length;
  return { done, total: cl.tasks.length };
}

function nearestActiveDeadline(school: School, now: Date): { type: 'ED' | 'EA' | 'RD'; days: number } | null {
  const candidates: Array<{ type: 'ED' | 'EA' | 'RD'; days: number | null }> = [
    { type: 'ED', days: daysUntil(school.ed_deadline, now) },
    { type: 'EA', days: daysUntil(school.ea_deadline, now) },
    { type: 'RD', days: daysUntil(school.rd_deadline, now) },
  ];
  let best: { type: 'ED' | 'EA' | 'RD'; days: number } | null = null;
  for (const c of candidates) {
    if (c.days == null || c.days < 0) continue;
    if (!best || c.days < best.days) best = { type: c.type, days: c.days };
  }
  return best;
}

// ─── Rules ────────────────────────────────────────────────────────

function ruleDeadlines(s: JumpOffState): JumpOff[] {
  if (!s.applying.length) return [];
  const out: JumpOff[] = [];
  for (const unitid of s.applying) {
    const school = findSchool(s, unitid);
    if (!school) continue;
    const nearest = nearestActiveDeadline(school, s.now);
    if (!nearest) continue;
    if (nearest.days > 60) continue; // far out; let other rules surface
    let priority: number;
    let urgency: JumpOffUrgency;
    if (nearest.days <= 7) { priority = 100 - nearest.days; urgency = 'red'; }
    else if (nearest.days <= 14) { priority = 90 - (nearest.days - 7); urgency = 'red'; }
    else if (nearest.days <= 30) { priority = 60 + (30 - nearest.days); urgency = 'yellow'; }
    else { priority = 40 + Math.round((60 - nearest.days) / 3); urgency = 'yellow'; }
    const { done, total } = progressFor(s, unitid);
    const sub = total > 0 ? `${done}/${total} checklist tasks complete` : undefined;
    out.push({
      id: `deadline_${unitid}`,
      title: `${school.short} ${nearest.type} in ${nearest.days} day${nearest.days === 1 ? '' : 's'}`,
      subtitle: sub,
      icon: 'deadline',
      urgency,
      priority,
      href: `/schools/${unitid}/checklist`,
    });
  }
  return out;
}

function ruleProfileCompletion(s: JumpOffState): JumpOff[] {
  if (!s.onboardingComplete) {
    return [{
      id: 'profile_onboarding',
      title: 'Finish onboarding',
      subtitle: 'Your match scores need your profile to be filled out',
      icon: 'profile',
      urgency: 'yellow',
      priority: 88,
      href: '/',
    }];
  }
  const missing: string[] = [];
  if (!s.profile.gpaUnweighted) missing.push('GPA');
  if (!s.profile.satScore && !s.profile.actScore) missing.push('test scores');
  if ((s.profile.activities || []).length === 0) missing.push('activities');
  if ((s.profile.apCourses || []).length === 0 && (s.profile.honorsCount || 0) === 0) missing.push('coursework');
  if (missing.length === 0) return [];
  return [{
    id: 'profile_completion',
    title: missing.length === 1
      ? `Add your ${missing[0]} to your profile`
      : `Add ${missing.length} missing fields to your profile`,
    subtitle: `Missing: ${missing.join(', ')}`,
    icon: 'profile',
    urgency: missing.length >= 2 ? 'yellow' : 'green',
    priority: 50 + missing.length * 8,
    href: '/profile',
  }];
}

function ruleEmptyApplyingList(s: JumpOffState): JumpOff[] {
  if (!s.onboardingComplete) return [];
  if (s.applying.length > 0) return [];
  return [{
    id: 'empty_applying',
    title: "You haven't marked any schools yet",
    subtitle: 'Tap a school card and use the "+ I\'m Applying" button',
    icon: 'discover',
    urgency: 'yellow',
    priority: 65,
    href: '/schools',
  }];
}

function ruleListBalance(s: JumpOffState): JumpOff[] {
  if (s.applying.length < 2) return [];
  const cats = s.applying
    .map(unitid => s.matchResults.find(r => r.schoolUnitid === unitid)?.matchCategory)
    .filter(Boolean) as string[];
  if (cats.length === 0) return [];
  const reaches = cats.filter(c => c === 'reach' || c === 'far_reach').length;
  const safeties = cats.filter(c => c === 'safety').length;
  if (safeties === 0 && reaches >= cats.length - (cats.length >= 4 ? 1 : 0)) {
    return [{
      id: 'list_all_reaches',
      title: 'Your list is mostly reaches',
      subtitle: 'Add 1–2 safeties to balance — see schools where you have a Safety match',
      icon: 'discover',
      urgency: 'yellow',
      priority: 70,
      href: '/schools?filter=safety',
    }];
  }
  return [];
}

function ruleUntouchedChecklist(s: JumpOffState): JumpOff[] {
  const out: JumpOff[] = [];
  for (const unitid of s.applying) {
    const { done } = progressFor(s, unitid);
    if (done > 0) continue;
    const school = findSchool(s, unitid);
    if (!school) continue;
    const nearest = nearestActiveDeadline(school, s.now);
    if (!nearest) continue;
    if (nearest.days > 90) continue;
    let priority = 30;
    if (nearest.days <= 30) priority = 50;
    if (nearest.days <= 14) priority = 60;
    if (nearest.days <= 7) priority = 70;
    out.push({
      id: `untouched_${unitid}`,
      title: `Start ${school.short}'s application checklist`,
      subtitle: `${nearest.days} days to ${nearest.type} deadline`,
      icon: 'task',
      urgency: nearest.days <= 14 ? 'red' : 'yellow',
      priority,
      href: `/schools/${unitid}/checklist`,
    });
  }
  return out;
}

function ruleTestScoreGap(s: JumpOffState): JumpOff[] {
  if (!s.onboardingComplete) return [];
  if (s.profile.satScore || s.profile.actScore) return [];
  const hasSelectiveTarget = s.applying.some(unitid => {
    const sc = findSchool(s, unitid);
    return sc && (sc.selectivity === 'ultra_selective' || sc.selectivity === 'highly_selective');
  });
  if (!hasSelectiveTarget) return [];
  return [{
    id: 'test_score_gap',
    title: 'No SAT/ACT logged',
    subtitle: 'Some schools on your list weight test scores heavily',
    icon: 'task',
    urgency: 'yellow',
    priority: 55,
    href: '/profile',
  }];
}

function ruleFafsaWindow(s: JumpOffState): JumpOff[] {
  if (s.profile.grade !== 12) return [];
  const month = s.now.getMonth() + 1;
  const day = s.now.getDate();
  if (month < 1 || month > 3) return [];
  if (month === 3 && day > 15) return [];
  return [{
    id: 'fafsa_window',
    title: 'FAFSA filing window is open',
    subtitle: 'Most schools want it by mid-February',
    icon: 'finance',
    urgency: month >= 3 ? 'red' : 'yellow',
    priority: 70 + (month === 3 ? 15 : month === 2 ? 8 : 0),
    href: `/chat?prompt=${encodeURIComponent('Help me think through FAFSA — what do I need to do this month?')}`,
  }];
}

function ruleCounselorFirstTouch(s: JumpOffState): JumpOff[] {
  if (s.chatActivity.hasEverChatted) return [];
  if (!s.onboardingComplete) {
    return [{
      id: 'counselor_first_pre',
      title: 'Try the AI counselor',
      subtitle: 'Finish onboarding for personalized advice',
      icon: 'chat',
      urgency: 'green',
      priority: 32,
      href: '/chat',
    }];
  }
  return [{
    id: 'counselor_first',
    title: 'Talk to your AI counselor',
    subtitle: 'Ask about your list, your chances, or your strategy',
    icon: 'chat',
    urgency: 'green',
    priority: 60,
    href: '/chat',
  }];
}

function ruleResumeChat(s: JumpOffState): JumpOff[] {
  const last = s.chatActivity.lastMessageTs;
  if (!last) return [];
  const hoursAgo = (s.now.getTime() - last) / (1000 * 60 * 60);
  if (hoursAgo > 72) return [];
  if (hoursAgo < 0.25) return [];
  return [{
    id: 'resume_chat',
    title: 'Continue your conversation with the counselor',
    subtitle: hoursAgo < 1 ? 'Just now' : `${Math.round(hoursAgo)}h ago`,
    icon: 'chat',
    urgency: 'green',
    priority: 45,
    href: '/chat',
  }];
}

function ruleDiscoverSchools(s: JumpOffState): JumpOff[] {
  return [{
    id: 'discover',
    title: 'Browse all schools',
    subtitle: s.onboardingComplete
      ? `${s.schools.length} schools, sorted by your match`
      : `${s.schools.length} schools — explore the database`,
    icon: 'discover',
    urgency: 'green',
    priority: s.onboardingComplete ? 25 : 30,
    href: '/schools',
  }];
}

function ruleViewApplying(s: JumpOffState): JumpOff[] {
  if (s.applying.length === 0) return [];
  return [{
    id: 'view_applying',
    title: `Review your applying list`,
    subtitle: `${s.applying.length} school${s.applying.length === 1 ? '' : 's'} marked`,
    icon: 'task',
    urgency: 'green',
    priority: 20,
    href: '/schools?filter=applying',
  }];
}

function ruleViewFavorites(s: JumpOffState): JumpOff[] {
  if (s.favorites.length === 0) return [];
  return [{
    id: 'view_favorites',
    title: `Review your favorites`,
    subtitle: `${s.favorites.length} school${s.favorites.length === 1 ? '' : 's'} starred`,
    icon: 'task',
    urgency: 'green',
    priority: 19,
    href: '/schools?filter=favorites',
  }];
}

function ruleEditProfile(s: JumpOffState): JumpOff[] {
  if (!s.onboardingComplete) return [];
  return [{
    id: 'edit_profile',
    title: 'Refine your profile',
    subtitle: 'Update GPA, scores, courses, or activities',
    icon: 'profile',
    urgency: 'green',
    priority: 18,
    href: '/profile',
  }];
}

function ruleChatStarterListReview(s: JumpOffState): JumpOff[] {
  return [{
    id: 'chat_starter_balance',
    title: 'Ask the counselor: "Is my list balanced?"',
    subtitle: 'Get a take on your safeties, matches, and reaches',
    icon: 'chat',
    urgency: 'green',
    priority: 17,
    href: `/chat?prompt=${encodeURIComponent('Is my list balanced?')}`,
  }];
}

function ruleChatStarterLeverage(s: JumpOffState): JumpOff[] {
  if (!s.onboardingComplete) return [];
  return [{
    id: 'chat_starter_leverage',
    title: 'Ask the counselor: "What would move my chances most?"',
    subtitle: 'Find your single highest-leverage change',
    icon: 'chat',
    urgency: 'green',
    priority: 16,
    href: `/chat?prompt=${encodeURIComponent('What single change would move my chances most?')}`,
  }];
}

function ruleChatStarterPickFive(s: JumpOffState): JumpOff[] {
  return [{
    id: 'chat_starter_pickfive',
    title: 'Ask the counselor: "Pick 5 schools I should focus on"',
    subtitle: 'Narrow your list to the most promising bets',
    icon: 'chat',
    urgency: 'green',
    priority: 14,
    href: `/chat?prompt=${encodeURIComponent('Pick 5 schools I should focus on, and explain why.')}`,
  }];
}

const RULES: ((s: JumpOffState) => JumpOff[])[] = [
  ruleDeadlines,
  ruleProfileCompletion,
  ruleEmptyApplyingList,
  ruleListBalance,
  ruleUntouchedChecklist,
  ruleTestScoreGap,
  ruleFafsaWindow,
  ruleCounselorFirstTouch,
  ruleResumeChat,
  ruleDiscoverSchools,
  ruleViewApplying,
  ruleViewFavorites,
  ruleEditProfile,
  ruleChatStarterListReview,
  ruleChatStarterLeverage,
  ruleChatStarterPickFive,
];
