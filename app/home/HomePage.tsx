'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useApp } from '../lib/context';
import BottomNav from '../components/BottomNav';
import { ScholaraWordmark } from '../components/ScholaraLogo';
import { useApplying } from '../lib/useApplying';
import { useFavorites } from '../lib/useFavorites';
import { loadAllChecklistState } from '../lib/storage';
import { computeJumpOffs, JumpOff } from '../lib/jumpOffs';
import { track } from '../lib/events';
import { MAJOR_OPTIONS } from '../lib/types';
import checklistsData from '../../data/checklists.json';
import { computeBenchmarks } from '../lib/benchmarks';
import { BenchmarksDisplay } from '../components/Benchmarks';
import { displayName } from '../lib/encouragement';
import { useRoadmap } from '../lib/useRoadmap';
import { GRADE_LABELS as ROADMAP_GRADE_LABELS, ROADMAP_DATA, RoadmapGrade } from '../lib/roadmap';

// Friendly grade labels
const GRADE_LABEL: Record<9 | 10 | 11 | 12, string> = {
  9: 'Freshman',
  10: 'Sophomore',
  11: 'Junior',
  12: 'Senior',
};

// One item that shows up in the This-Month / Next-Month list
interface MonthItem {
  date: Date;
  title: string;
  subtitle: string;
  href: string;
  type: 'deadline' | 'task';
  done?: boolean;
}

function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function startOfNextMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth() + 1, 1); }
function startOfMonthAfter(d: Date, n: number): Date { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function fmtMonthLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function fmtDayLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const URGENCY_COLOR: Record<JumpOff['urgency'], string> = {
  red: '#F87171',
  yellow: '#FACC15',
  green: '#2DD4BF',
};

const ICON_GLYPH: Record<JumpOff['icon'], string> = {
  deadline: '⏰',
  chat: '💬',
  task: '✓',
  discover: '🔍',
  profile: '👤',
  finance: '$',
  methodology: '📖',
};

export default function HomePage() {
  const { profile, matchResults, schools, onboardingComplete, isCalculating, readinessScore } = useApp();
  const { applying } = useApplying();
  const { favorites } = useFavorites();

  const safetyCount = matchResults.filter(r => r.matchCategory === 'safety').length;
  const matchCount = matchResults.filter(r => r.matchCategory === 'match').length;
  const reachCount = matchResults.filter(r => r.matchCategory === 'reach').length;
  const farReachCount = matchResults.filter(r => r.matchCategory === 'far_reach').length;

  const checklists = checklistsData as Record<string, {
    platform: string; platformUrl: string; deadlines: Record<string, string>;
    tasks: Array<{ id: string; title: string; category: string; description: string; dueDate: string; estimatedMinutes: number }>;
  }>;

  const cards = useMemo(() => {
    if (typeof window === 'undefined') return [];
    const checklistProgress = loadAllChecklistState();
    let lastMessageTs: number | null = null;
    let hasEverChatted = false;
    try {
      const ts = localStorage.getItem('scholara_chat_last_ts');
      if (ts) lastMessageTs = parseInt(ts, 10);
      const history = localStorage.getItem('scholara_chat_history');
      if (history && JSON.parse(history)?.length > 0) hasEverChatted = true;
    } catch {}
    return computeJumpOffs({
      profile,
      applying,
      favorites,
      matchResults,
      schools,
      checklists,
      checklistProgress,
      onboardingComplete,
      now: new Date(),
      chatActivity: { hasEverChatted, lastMessageTs },
    }, 5);
  }, [profile, applying, favorites, matchResults, schools, checklists, onboardingComplete]);

  // Telemetry: fire home_card_shown once per render set
  const lastShownRef = useRef<string>('');
  useEffect(() => {
    if (cards.length === 0) return;
    const key = cards.map(c => c.id).join('|');
    if (lastShownRef.current === key) return;
    lastShownRef.current = key;
    track('home_cards_shown', {
      ids: cards.map(c => c.id).join(','),
      priorities: cards.map(c => c.priority).join(','),
    });
  }, [cards]);

  const dn = displayName(profile);
  const greeting = dn ? `Hi, ${dn}` : 'Welcome to Scholara';

  // Grade + major chip line under the greeting (only what's set)
  const gradeLabel = profile.grade ? GRADE_LABEL[profile.grade] : null;
  const majorLabel = profile.intendedMajor
    ? (MAJOR_OPTIONS.find(m => m.value === profile.intendedMajor)?.label ?? null)
    : null;

  // Month view: 0 = this month, 1 = next month
  const [monthOffset, setMonthOffset] = useState<0 | 1>(0);
  const now = new Date();
  const winStart = startOfMonthAfter(now, monthOffset);
  const winEnd = startOfMonthAfter(now, monthOffset + 1);

  // Gather all items (deadlines from applying schools + checklist tasks)
  // then filter to the selected month and sort by date.
  const monthItems: MonthItem[] = useMemo(() => {
    if (!onboardingComplete) return [];
    const items: MonthItem[] = [];
    const checklistProgress = (() => {
      try { return loadAllChecklistState(); } catch { return {}; }
    })();

    for (const unitid of applying) {
      const school = schools.find(s => s.unitid === unitid);
      if (!school) continue;

      // School-level deadlines (ED/EA/RD)
      for (const [field, label] of [
        ['ed_deadline', 'Early Decision'],
        ['ea_deadline', 'Early Action'],
        ['rd_deadline', 'Regular Decision'],
      ] as const) {
        const raw = (school as unknown as Record<string, string | null>)[field];
        if (!raw) continue;
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) continue;
        items.push({
          date: d,
          title: `${label} deadline`,
          subtitle: school.name,
          href: `/schools/${unitid}`,
          type: 'deadline',
        });
      }

      // Per-school checklist tasks (only UCI + CMU are wired today)
      const checklist = checklists[unitid];
      if (checklist) {
        const progress = checklistProgress[unitid] ?? {};
        for (const t of checklist.tasks) {
          if (!t.dueDate) continue;
          const d = new Date(t.dueDate);
          if (Number.isNaN(d.getTime())) continue;
          items.push({
            date: d,
            title: t.title,
            subtitle: school.name,
            href: `/schools/${unitid}/checklist`,
            type: 'task',
            done: !!progress[t.id],
          });
        }
      }
    }

    return items
      .filter(i => i.date >= winStart && i.date < winEnd)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [onboardingComplete, applying, schools, checklists, winStart, winEnd]);

  // Pick an anchor school for the "Where you stand" benchmarks.
  // Preference: top reach school → top match → top favorite → top match overall.
  const benchAnchor = useMemo(() => {
    if (!onboardingComplete || matchResults.length === 0) return null;
    const pool = new Set([...applying, ...favorites]);
    const byScore = [...matchResults].sort((a, b) => b.matchScore - a.matchScore);
    const userPool = byScore.filter(r => pool.has(r.schoolUnitid));
    const topReach = userPool.find(r => r.matchCategory === 'reach') ?? userPool.find(r => r.matchCategory === 'far_reach');
    const topMatch = userPool.find(r => r.matchCategory === 'match');
    const fallback = userPool[0] ?? byScore[0];
    const pick = topReach ?? topMatch ?? fallback;
    if (!pick) return null;
    const school = schools.find(s => s.unitid === pick.schoolUnitid);
    if (!school) return null;
    return { school, result: pick };
  }, [onboardingComplete, matchResults, applying, favorites, schools]);

  const benchmarkLines = useMemo(
    () => (benchAnchor ? computeBenchmarks(profile, benchAnchor.school) : []),
    [profile, benchAnchor]
  );

  // Roadmap progress for Home card. Anchors to the student's current grade; if
  // grade is null, sums across all grades (just shows total).
  const { doneCountForGrade, doneCountTotal } = useRoadmap();
  const roadmapProgress = useMemo(() => {
    if (profile.grade) {
      const { done, total } = doneCountForGrade(profile.grade as RoadmapGrade);
      return { done, total, label: `${ROADMAP_GRADE_LABELS[profile.grade as RoadmapGrade].toLowerCase()} year` };
    }
    const { done, total } = doneCountTotal();
    return { done, total, label: 'all years' };
  }, [profile.grade, doneCountForGrade, doneCountTotal]);
  const nextRoadmapItem = useMemo(() => {
    if (!profile.grade) return null;
    return ROADMAP_DATA.find(i => i.grade === profile.grade) ?? null;
  }, [profile.grade]);

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0A0F0E',
      paddingBottom: 100,
    }}>
      {/* Header */}
      <div style={{
        padding: '24px 20px 8px',
        paddingTop: 'max(24px, env(safe-area-inset-top))',
      }}>
        <div style={{ marginBottom: 16 }}>
          <ScholaraWordmark size={22} />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#F0FAFA', margin: 0 }}>
          {greeting}
        </h1>
        {(gradeLabel || majorLabel) && (
          <div style={{ fontSize: 13, color: '#7A9E9B', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            {gradeLabel && <span>{gradeLabel}</span>}
            {gradeLabel && majorLabel && <span style={{ color: '#4A6560' }}>·</span>}
            {majorLabel && <span>{majorLabel}</span>}
          </div>
        )}
        <p style={{ fontSize: 13, color: '#7A9E9B', marginTop: 6, marginBottom: 0 }}>
          {onboardingComplete
            ? 'Here’s what to focus on right now.'
            : 'Let’s get you set up.'}
        </p>
      </div>

      {/* Live Match Summary */}
      {onboardingComplete && (
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{
            background: '#111918',
            border: '1px solid #1E302E',
            borderRadius: 16,
            padding: '14px 16px',
          }}>
            <div style={{ fontSize: 12, color: '#7A9E9B', marginBottom: 10 }}>Live Match Summary (moves in real-time as you edit)</div>
            <div style={{ display: 'flex', gap: 0 }}>
              {[
                { label: 'Readiness', value: readinessScore, color: '#2DD4BF' },
                { label: 'Safety', value: safetyCount, color: '#4ADE80' },
                { label: 'Match', value: matchCount, color: '#2DD4BF' },
                { label: 'Reach', value: reachCount, color: '#FACC15' },
                { label: 'Far Reach', value: farReachCount, color: '#F87171' },
              ].map((s, i) => (
                <div key={s.label} style={{
                  flex: 1,
                  textAlign: 'center',
                  borderRight: i < 4 ? '1px solid #1E302E' : 'none',
                  padding: '4px 0',
                }}>
                  <div style={{ fontSize: i === 0 ? 20 : 18, fontWeight: 700, color: s.color }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: 9, color: '#7A9E9B', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Where you stand vs anchor school (peer benchmarks from CDS) */}
      {onboardingComplete && benchAnchor && benchmarkLines.length > 0 && (
        <div style={{ padding: '16px 20px 0' }}>
          <Link href={`/schools/${benchAnchor.school.unitid}`} style={{ textDecoration: 'none' }}>
            <div style={{
              background: '#111918',
              border: '1px solid #1E302E',
              borderRadius: 16,
              padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: '#7A9E9B' }}>Where you stand vs.</div>
                  <div style={{ fontSize: 14, color: '#F0FAFA', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {benchAnchor.school.name}
                  </div>
                </div>
                <div style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: benchAnchor.result.matchCategory === 'safety' ? '#4ADE8015'
                    : benchAnchor.result.matchCategory === 'match' ? '#2DD4BF15'
                    : benchAnchor.result.matchCategory === 'reach' ? '#FACC1515'
                    : '#F8717115',
                  color: benchAnchor.result.matchCategory === 'safety' ? '#4ADE80'
                    : benchAnchor.result.matchCategory === 'match' ? '#2DD4BF'
                    : benchAnchor.result.matchCategory === 'reach' ? '#FACC15'
                    : '#F87171',
                  flexShrink: 0,
                  textTransform: 'capitalize',
                }}>
                  {benchAnchor.result.matchCategory.replace('_', ' ')}
                </div>
              </div>
              <BenchmarksDisplay profile={profile} school={benchAnchor.school} />
              <div style={{ marginTop: 10, fontSize: 10, color: '#4A6560', textAlign: 'right' }}>
                Source: IPEDS 2024 + school CDS · tap for full math →
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* This Month / Next Month */}
      {onboardingComplete && (
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{
            background: '#111918',
            border: '1px solid #1E302E',
            borderRadius: 16,
            padding: '14px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: '#F0FAFA', fontWeight: 600 }}>
                {monthOffset === 0 ? 'This Month' : 'Next Month'}
                <span style={{ fontSize: 11, color: '#7A9E9B', marginLeft: 8, fontWeight: 400 }}>
                  · {fmtMonthLabel(winStart)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 0 }}>
                {([
                  { value: 0 as const, label: 'This' },
                  { value: 1 as const, label: 'Next' },
                ]).map((opt, i, arr) => {
                  const active = monthOffset === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setMonthOffset(opt.value)}
                      style={{
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: 600,
                        border: '1px solid #1E302E',
                        borderLeft: i === 0 ? '1px solid #1E302E' : 'none',
                        borderRadius: i === 0 ? '6px 0 0 6px' : i === arr.length - 1 ? '0 6px 6px 0' : 0,
                        background: active ? '#2DD4BF' : '#162220',
                        color: active ? '#0A0F0E' : '#7A9E9B',
                        cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {monthItems.length === 0 ? (
              <div style={{ fontSize: 12, color: '#4A6560', fontStyle: 'italic', padding: '4px 0' }}>
                {applying.length === 0
                  ? 'Mark a school as “Applying” to see its deadlines here.'
                  : monthOffset === 0
                    ? 'Nothing due this month — keep building your profile.'
                    : 'Nothing due next month — enjoy the breather.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {monthItems.map((item, idx) => (
                  <Link
                    key={`${item.href}-${item.title}-${idx}`}
                    href={item.href}
                    style={{ textDecoration: 'none' }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: '#0F1817',
                      border: '1px solid #1E302E',
                      opacity: item.done ? 0.55 : 1,
                    }}>
                      <div style={{
                        flexShrink: 0,
                        width: 44,
                        textAlign: 'center',
                        fontSize: 11,
                        color: item.type === 'deadline' ? '#F87171' : '#7A9E9B',
                        fontWeight: 600,
                      }}>
                        {fmtDayLabel(item.date)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13,
                          color: '#F0FAFA',
                          fontWeight: 500,
                          textDecoration: item.done ? 'line-through' : 'none',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {item.title}
                        </div>
                        <div style={{
                          fontSize: 11,
                          color: '#7A9E9B',
                          marginTop: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {item.subtitle}
                        </div>
                      </div>
                      <div style={{ fontSize: 14, color: '#4A6560', flexShrink: 0 }}>›</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Roadmap progress card */}
      {onboardingComplete && (
        <div style={{ padding: '16px 20px 0' }}>
          <Link href="/timeline" style={{ textDecoration: 'none' }}>
            <div style={{
              background: '#111918',
              border: '1px solid #1E302E',
              borderRadius: 16,
              padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#7A9E9B', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>
                    Your roadmap
                  </div>
                  <div style={{ fontSize: 14, color: '#F0FAFA', fontWeight: 600 }}>
                    {profile.grade
                      ? `${roadmapProgress.done} of ${roadmapProgress.total} done · ${roadmapProgress.label}`
                      : 'Set your grade to start'}
                  </div>
                </div>
                <div style={{ fontSize: 22, color: '#7A9E9B' }}>›</div>
              </div>
              {/* Progress bar */}
              <div style={{ height: 4, background: '#1E302E', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{
                  height: '100%',
                  width: roadmapProgress.total > 0 ? `${(roadmapProgress.done / roadmapProgress.total) * 100}%` : '0%',
                  background: '#2DD4BF',
                  transition: 'width 0.3s ease',
                }} />
              </div>
              {nextRoadmapItem && (
                <div style={{ fontSize: 11, color: '#4A6560', lineHeight: 1.4 }}>
                  Up next: {nextRoadmapItem.title}
                </div>
              )}
            </div>
          </Link>
        </div>
      )}

      {/* Jump-off cards */}
      <div style={{ padding: '16px 20px 0' }}>
        {isCalculating && cards.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#7A9E9B', fontSize: 13 }}>
            Loading…
          </div>
        ) : (
          cards.map(card => <JumpOffCard key={card.id} card={card} />)
        )}
      </div>

      <BottomNav />
    </div>
  );
}

function JumpOffCard({ card }: { card: JumpOff }) {
  const accent = URGENCY_COLOR[card.urgency];
  const borderColor =
    card.urgency === 'red' ? `${accent}55`
    : card.urgency === 'yellow' ? `${accent}30`
    : '#1E302E';
  const iconBg = `${accent}15`;
  const iconBorder = `${accent}30`;

  return (
    <Link
      href={card.href}
      onClick={() => track('home_card_clicked', { id: card.id, priority: card.priority })}
      style={{ textDecoration: 'none' }}
    >
      <div style={{
        background: '#111918',
        border: `1px solid ${borderColor}`,
        borderRadius: 14,
        padding: '14px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 10,
        transition: 'transform 0.1s',
      }}>
        <div style={{
          width: 42, height: 42,
          borderRadius: 11,
          background: iconBg,
          border: `1px solid ${iconBorder}`,
          display: 'grid',
          placeItems: 'center',
          fontSize: 18,
          color: accent,
          flexShrink: 0,
        }}>
          {ICON_GLYPH[card.icon]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#F0FAFA',
            lineHeight: 1.35,
          }}>
            {card.title}
          </div>
          {card.subtitle && (
            <div style={{
              fontSize: 12,
              color: '#7A9E9B',
              marginTop: 3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {card.subtitle}
            </div>
          )}
        </div>
        <div style={{ color: '#3A5452', fontSize: 22, flexShrink: 0, lineHeight: 1 }}>›</div>
      </div>
    </Link>
  );
}
