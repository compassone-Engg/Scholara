'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import BottomNav from '../../../components/BottomNav';
import schoolsData from '../../../../data/schools.json';
import checklistsData from '../../../../data/checklists.json';
import { School } from '../../../lib/types';
import { loadChecklistState, saveChecklistState } from '../../../lib/storage';

const schools = schoolsData as School[];

interface ChecklistTask {
  id: string;
  title: string;
  category: string;
  description: string;
  dueDate: string;
  estimatedMinutes: number;
}

interface ChecklistData {
  platform: string;
  platformUrl: string;
  deadlines: Record<string, string>;
  tasks: ChecklistTask[];
}

const checklists = checklistsData as Record<string, ChecklistData>;

const CATEGORY_CONFIG: Record<string, { label: string; color: string; order: number }> = {
  application:     { label: 'Application',     color: '#2DD4BF', order: 1 },
  essays:          { label: 'Essays',           color: '#FACC15', order: 2 },
  testing:         { label: 'Testing',          color: '#A78BFA', order: 3 },
  recommendations: { label: 'Recommendations', color: '#FB923C', order: 4 },
  activities:      { label: 'Activities',       color: '#60A5FA', order: 5 },
  financial:       { label: 'Financial',        color: '#4ADE80', order: 6 },
  'post-admission':    { label: 'Post-Admission',  color: '#F87171', order: 7 },
  'post-submission':   { label: 'Post-Submission', color: '#F87171', order: 8 },
};

const DEADLINE_LABELS: Record<string, string> = {
  filing_open:    'Filing Opens',
  filing_close:   'Filing Closes',
  sat_scores_due: 'SAT Scores Due',
  fafsa_due:      'FAFSA Due',
  sir_due:        'SIR Due',
  common_app_open:'Common App Opens',
  ed1:            'Early Decision I',
  ed2:            'Early Decision II',
  rd:             'Regular Decision',
  css_profile:    'CSS Profile Due',
  mid_year_report:'Mid-Year Report',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDaysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatCountdown(days: number): { text: string; color: string } {
  if (days < 0) return { text: 'Past due', color: '#F87171' };
  if (days === 0) return { text: 'Due today', color: '#F87171' };
  if (days <= 7) return { text: `${days}d left`, color: '#F87171' };
  if (days <= 30) return { text: `${days}d left`, color: '#FACC15' };
  return { text: `${days}d left`, color: '#7A9E9B' };
}

function formatEstimate(minutes: number): string {
  if (minutes < 60) return `~${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
}

export default function ChecklistClient({ unitid }: { unitid: string }) {
  const school = useMemo(() => schools.find(s => s.unitid === unitid), [unitid]);
  // Resolve in order: direct unitid match (UCI/CMU) -> school's policy.checklist_key
  // (set by Stage 0 to one of the platform templates) -> Common App fallback.
  const schoolWithPolicy = school as unknown as (School & { policy?: { checklist_key?: string } }) | undefined;
  const checklistKey = schoolWithPolicy?.policy?.checklist_key || 'common_app_template';
  const checklist = checklists[unitid] || checklists[checklistKey] || checklists['common_app_template'];

  const [completed, setCompleted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCompleted(loadChecklistState(unitid));
  }, [unitid]);

  const toggleTask = useCallback((taskId: string) => {
    setCompleted(prev => {
      const next = { ...prev, [taskId]: !prev[taskId] };
      saveChecklistState(unitid, next);
      return next;
    });
  }, [unitid]);

  if (!school || !checklist) {
    return (
      <div style={{ minHeight: '100dvh', background: '#0A0F0E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#7A9E9B' }}>Checklist not found</div>
      </div>
    );
  }

  const tasks = checklist.tasks;
  const totalTasks = tasks.length;
  const completedCount = tasks.filter(t => completed[t.id]).length;
  const progressPct = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

  // Group tasks by category, sorted by category order
  const grouped = useMemo(() => {
    const groups: Record<string, ChecklistTask[]> = {};
    for (const task of tasks) {
      if (!groups[task.category]) groups[task.category] = [];
      groups[task.category].push(task);
    }
    return Object.entries(groups).sort(([a], [b]) => {
      const orderA = CATEGORY_CONFIG[a]?.order ?? 99;
      const orderB = CATEGORY_CONFIG[b]?.order ?? 99;
      return orderA - orderB;
    });
  }, [tasks]);

  const deadlineEntries = Object.entries(checklist.deadlines);

  return (
    <div style={{ minHeight: '100dvh', background: '#0A0F0E', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{
        padding: '20px 20px 0',
        paddingTop: 'max(20px, env(safe-area-inset-top))',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <Link
            href={`/schools/${unitid}`}
            style={{ textDecoration: 'none', color: '#7A9E9B', fontSize: 14, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            ← Back
          </Link>
        </div>

        {/* School title + platform badge */}
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#F0FAFA', margin: '0 0 6px' }}>
            {school.name}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#7A9E9B' }}>Application Checklist</span>
            <span style={{ color: '#1E302E' }}>·</span>
            <a
              href={checklist.platformUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12,
                color: '#2DD4BF',
                textDecoration: 'none',
                background: '#2DD4BF18',
                border: '1px solid #2DD4BF30',
                borderRadius: 6,
                padding: '2px 8px',
                fontWeight: 600,
              }}
            >
              {checklist.platform} ↗
            </a>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{
          background: '#111918',
          border: '1px solid #1E302E',
          borderRadius: 14,
          padding: '14px 16px',
          marginBottom: 14,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#F0FAFA' }}>Progress</span>
            <span style={{ fontSize: 13, color: completedCount === totalTasks ? '#4ADE80' : '#2DD4BF', fontWeight: 700 }}>
              {completedCount}/{totalTasks} tasks
            </span>
          </div>
          <div style={{ height: 8, background: '#1E302E', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${progressPct}%`,
              background: completedCount === totalTasks
                ? 'linear-gradient(90deg, #4ADE8080, #4ADE80)'
                : 'linear-gradient(90deg, #2DD4BF80, #2DD4BF)',
              borderRadius: 4,
              transition: 'width 0.4s ease',
            }} />
          </div>
          {completedCount === totalTasks && totalTasks > 0 && (
            <div style={{ fontSize: 12, color: '#4ADE80', marginTop: 8, textAlign: 'center', fontWeight: 600 }}>
              All tasks complete! You're ready to apply.
            </div>
          )}
        </div>

        {/* Key deadlines */}
        <div style={{
          background: '#111918',
          border: '1px solid #1E302E',
          borderRadius: 14,
          padding: '14px 16px',
          marginBottom: 14,
        }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: '#F0FAFA', margin: '0 0 10px' }}>Key Deadlines</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {deadlineEntries.map(([key, dateStr]) => {
              const days = getDaysUntil(dateStr);
              const countdown = formatCountdown(days);
              return (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#7A9E9B' }}>
                    {DEADLINE_LABELS[key] || key}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#F0FAFA', fontWeight: 500 }}>
                      {formatDate(dateStr)}
                    </span>
                    <span style={{
                      fontSize: 10,
                      color: countdown.color,
                      fontWeight: 600,
                      background: `${countdown.color}15`,
                      borderRadius: 4,
                      padding: '1px 5px',
                    }}>
                      {countdown.text}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Task groups */}
      <div style={{ padding: '0 20px' }}>
        {grouped.map(([category, categoryTasks]) => {
          const cfg = CATEGORY_CONFIG[category] || { label: category, color: '#7A9E9B', order: 99 };
          const catCompleted = categoryTasks.filter(t => completed[t.id]).length;

          return (
            <div key={category} style={{ marginBottom: 20 }}>
              {/* Category header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: cfg.color,
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {cfg.label}
                </span>
                <span style={{ fontSize: 12, color: '#3A5452', marginLeft: 'auto' }}>
                  {catCompleted}/{categoryTasks.length}
                </span>
              </div>

              {/* Tasks */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {categoryTasks.map(task => {
                  const isDone = !!completed[task.id];
                  const days = getDaysUntil(task.dueDate);
                  const countdown = formatCountdown(days);

                  return (
                    <button
                      key={task.id}
                      onClick={() => toggleTask(task.id)}
                      style={{
                        width: '100%',
                        background: isDone ? '#0D1F1D' : '#111918',
                        border: isDone
                          ? '1px solid #4ADE8040'
                          : '1px solid #1E302E',
                        borderLeft: isDone
                          ? `3px solid #4ADE80`
                          : `3px solid ${cfg.color}60`,
                        borderRadius: 12,
                        padding: '12px 14px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s',
                        minHeight: 44,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        {/* Checkbox */}
                        <div style={{
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          border: isDone ? 'none' : `2px solid ${cfg.color}60`,
                          background: isDone ? '#4ADE80' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: 1,
                          transition: 'all 0.15s',
                        }}>
                          {isDone && (
                            <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
                              <path d="M1.5 5L5 8.5L11.5 1.5" stroke="#0A0F0E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: isDone ? '#4A7A6E' : '#F0FAFA',
                            textDecoration: isDone ? 'line-through' : 'none',
                            marginBottom: 4,
                            lineHeight: 1.35,
                          }}>
                            {task.title}
                          </div>
                          <div style={{
                            fontSize: 12,
                            color: isDone ? '#3A5452' : '#7A9E9B',
                            lineHeight: 1.45,
                            marginBottom: 8,
                          }}>
                            {task.description}
                          </div>

                          {/* Meta row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            {/* Due date */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: 11, color: '#3A5452' }}>Due</span>
                              <span style={{ fontSize: 11, color: isDone ? '#3A5452' : '#F0FAFA', fontWeight: 500 }}>
                                {formatDate(task.dueDate)}
                              </span>
                            </div>

                            {/* Countdown */}
                            {!isDone && (
                              <span style={{
                                fontSize: 10,
                                color: countdown.color,
                                background: `${countdown.color}15`,
                                border: `1px solid ${countdown.color}25`,
                                borderRadius: 4,
                                padding: '1px 5px',
                                fontWeight: 600,
                              }}>
                                {countdown.text}
                              </span>
                            )}

                            {/* Time estimate */}
                            <span style={{
                              fontSize: 10,
                              color: '#3A5452',
                              background: '#162220',
                              borderRadius: 4,
                              padding: '1px 5px',
                              marginLeft: 'auto',
                            }}>
                              {formatEstimate(task.estimatedMinutes)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}
