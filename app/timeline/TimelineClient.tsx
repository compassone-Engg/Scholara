'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useApp } from '../lib/context';
import BottomNav from '../components/BottomNav';
import { ScholaraWordmark } from '../components/ScholaraLogo';
import {
  ROADMAP_DATA,
  ROADMAP_CATEGORY_COLORS,
  ROADMAP_CATEGORY_ICONS,
  GRADE_LABELS,
  RoadmapGrade,
  isGradeLocked,
} from '../lib/roadmap';
import { useRoadmap } from '../lib/useRoadmap';

export default function TimelineClient() {
  const { profile } = useApp();
  const { isDone, toggle, doneCountForGrade } = useRoadmap();

  // Default active tab: student's current grade, or grade 9 if not set
  const [activeGrade, setActiveGrade] = useState<RoadmapGrade>(profile.grade ?? 9);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const gradeItems = useMemo(
    () => ROADMAP_DATA.filter(item => item.grade === activeGrade),
    [activeGrade]
  );

  const { done, total } = doneCountForGrade(activeGrade);
  const locked = isGradeLocked(activeGrade, profile.grade);
  const noGradeSet = profile.grade === null;

  const toggleExpand = (key: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <div style={{ minHeight: '100dvh', background: '#0A0F0E', paddingBottom: 100 }}>
      {/* Header */}
      <div style={{
        padding: '20px 20px 0',
        paddingTop: 'max(20px, env(safe-area-inset-top))',
      }}>
        <div style={{ marginBottom: 12 }}>
          <ScholaraWordmark size={22} />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#F0FAFA', margin: '0 0 4px' }}>Roadmap</h1>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: '#7A9E9B' }}>Your 4-year college prep plan</p>

        {/* Set-grade banner (if grade is null) */}
        {noGradeSet && (
          <div style={{
            background: '#1A4540',
            border: '1px solid #2DD4BF55',
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <div style={{ fontSize: 22, flexShrink: 0 }}>🔓</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: '#F0FAFA', fontWeight: 600, marginBottom: 2 }}>
                Set your grade to unlock check-offs
              </div>
              <div style={{ fontSize: 11, color: '#7A9E9B', lineHeight: 1.4 }}>
                We can&apos;t lock future items or track progress until we know what year you&apos;re in.
              </div>
            </div>
            <Link
              href="/profile"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#0A0F0E',
                background: '#2DD4BF',
                padding: '8px 12px',
                borderRadius: 8,
                textDecoration: 'none',
                flexShrink: 0,
              }}
            >
              Set grade
            </Link>
          </div>
        )}

        {/* Grade tabs */}
        <div style={{ display: 'flex', gap: 0, background: '#111918', borderRadius: 12, padding: 3, marginBottom: 16 }}>
          {([9, 10, 11, 12] as const).map(g => {
            const lockedTab = isGradeLocked(g, profile.grade);
            const isCurrent = g === profile.grade;
            return (
              <button
                key={g}
                onClick={() => setActiveGrade(g)}
                style={{
                  flex: 1,
                  padding: '9px 4px',
                  borderRadius: 10,
                  border: 'none',
                  background: activeGrade === g ? '#2DD4BF' : 'transparent',
                  color: activeGrade === g ? '#0A0F0E' : '#7A9E9B',
                  fontSize: 13,
                  fontWeight: activeGrade === g ? 700 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative',
                }}
              >
                Gr {g}
                {lockedTab && activeGrade !== g && (
                  <span style={{ display: 'block', fontSize: 8, marginTop: 1, opacity: 0.7 }}>🔒</span>
                )}
                {isCurrent && activeGrade !== g && (
                  <span style={{ display: 'block', fontSize: 8, marginTop: 1, color: '#4ADE80' }}>●</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grade header + progress */}
      <div style={{ padding: '0 20px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              background: locked ? 'rgba(122,158,155,0.12)' : 'rgba(45,212,191,0.1)',
              border: `1px solid ${locked ? 'rgba(122,158,155,0.3)' : 'rgba(45,212,191,0.2)'}`,
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: 13,
              color: locked ? '#7A9E9B' : '#2DD4BF',
              fontWeight: 600,
            }}>
              Grade {activeGrade} — {GRADE_LABELS[activeGrade]}
            </div>
            {activeGrade === profile.grade && (
              <div style={{ fontSize: 12, color: '#4ADE80', display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ADE80' }} />
                Current year
              </div>
            )}
            {locked && (
              <div style={{ fontSize: 12, color: '#7A9E9B', display: 'flex', alignItems: 'center', gap: 4 }}>
                🔒 Unlocks {GRADE_LABELS[activeGrade].toLowerCase()} year
              </div>
            )}
          </div>
          <div style={{
            fontSize: 11,
            color: '#7A9E9B',
            fontWeight: 600,
          }}>
            {done} / {total} done
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ marginTop: 8, height: 4, background: '#1E302E', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: total > 0 ? `${(done / total) * 100}%` : '0%',
            background: locked ? '#4A6560' : '#2DD4BF',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Roadmap items */}
      <div style={{ padding: '8px 20px 0', position: 'relative' }}>
        {/* Vertical guide line */}
        <div style={{
          position: 'absolute',
          left: 36,
          top: 0,
          bottom: 0,
          width: 2,
          background: '#1E302E',
        }} />

        {gradeItems.map(item => {
          const expanded = expandedItems.has(item.id);
          const color = ROADMAP_CATEGORY_COLORS[item.category];
          const checked = isDone(item.id);
          const lockedItem = locked;

          return (
            <div
              key={item.id}
              style={{
                display: 'flex',
                gap: 14,
                marginBottom: 12,
                position: 'relative',
                opacity: lockedItem ? 0.45 : 1,
              }}
            >
              {/* Timeline dot — turns into checkbox area */}
              <div style={{ position: 'relative', zIndex: 1, flexShrink: 0, marginLeft: 4 }}>
                <button
                  onClick={() => { if (!lockedItem && !noGradeSet) toggle(item.id); }}
                  disabled={lockedItem || noGradeSet}
                  aria-label={checked ? `Mark "${item.title}" as not done` : `Mark "${item.title}" as done`}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: checked ? '#2DD4BF' : (lockedItem ? '#1E302E' : `${color}20`),
                    border: `2px solid ${checked ? '#2DD4BF' : (lockedItem ? '#2A3A38' : color)}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    cursor: lockedItem || noGradeSet ? 'not-allowed' : 'pointer',
                    padding: 0,
                  }}
                >
                  {checked
                    ? <span style={{ color: '#0A0F0E', fontWeight: 900, fontSize: 16 }}>✓</span>
                    : lockedItem
                      ? <span style={{ fontSize: 12 }}>🔒</span>
                      : <span>{ROADMAP_CATEGORY_ICONS[item.category]}</span>}
                </button>
              </div>

              {/* Content */}
              <button
                onClick={() => toggleExpand(item.id)}
                style={{
                  flex: 1,
                  background: '#111918',
                  border: `1px solid ${item.isDeadline && !lockedItem && !checked ? `${color}40` : '#1E302E'}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  marginBottom: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#F0FAFA',
                      marginBottom: 2,
                      textDecoration: checked ? 'line-through' : 'none',
                    }}>
                      {item.title}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 10,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: `${color}15`,
                        color,
                        fontWeight: 600,
                      }}>
                        {item.category}
                      </span>
                      {item.isDeadline && !checked && !lockedItem && (
                        <span style={{
                          fontSize: 10,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: 'rgba(248,113,113,0.1)',
                          color: '#F87171',
                          fontWeight: 600,
                        }}>
                          DEADLINE
                        </span>
                      )}
                      {lockedItem && (
                        <span style={{
                          fontSize: 10,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: 'rgba(122,158,155,0.1)',
                          color: '#7A9E9B',
                          fontWeight: 600,
                        }}>
                          🔒 LOCKED
                        </span>
                      )}
                      {checked && (
                        <span style={{
                          fontSize: 10,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: 'rgba(45,212,191,0.12)',
                          color: '#2DD4BF',
                          fontWeight: 600,
                        }}>
                          ✓ DONE
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{ color: '#7A9E9B', fontSize: 16, flexShrink: 0 }}>
                    {expanded ? '▲' : '▼'}
                  </span>
                </div>

                {expanded && (
                  <div style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: '1px solid #1E302E',
                    fontSize: 13,
                    color: '#7A9E9B',
                    lineHeight: 1.6,
                  }}>
                    {item.description}
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}
