'use client';

import { useState, useRef, useEffect } from 'react';
import { School, StudentProfile } from '../lib/types';
import { computeBenchmarks, BenchmarkLine } from '../lib/benchmarks';

/**
 * Inline rendering of benchmark lines. Used wherever there's room to show
 * the actual numbers (school detail page, algorithm header, onboarding done).
 */
export function BenchmarksDisplay({
  profile, school, compact = false,
}: {
  profile: StudentProfile;
  school: School;
  compact?: boolean;
}) {
  const lines = computeBenchmarks(profile, school);
  if (lines.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 4 : 6 }}>
      {lines.map((line, i) => (
        <BenchmarkRow key={i} line={line} compact={compact} divider={!compact && i < lines.length - 1} />
      ))}
    </div>
  );
}

function BenchmarkRow({ line, compact, divider }: { line: BenchmarkLine; compact: boolean; divider: boolean }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontSize: compact ? 11 : 12,
      padding: compact ? '3px 0' : '6px 0',
      borderBottom: divider ? '1px solid #162220' : 'none',
    }}>
      <div style={{
        flexShrink: 0,
        width: compact ? 52 : 64,
        color: '#7A9E9B',
        fontWeight: 600,
        fontSize: compact ? 9 : 11,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
      }}>
        {line.label}
      </div>
      <div style={{ flex: 1, color: '#F0FAFA' }}>{line.value}</div>
      {line.note && (
        <div style={{ flexShrink: 0, color: '#4A6560', fontSize: compact ? 10 : 11 }}>
          {line.note}
        </div>
      )}
    </div>
  );
}

/**
 * Small "ⓘ" icon that opens a popover with the benchmarks. Use this where
 * screen real estate is tight (school list cards, applying/favorites rows).
 */
export function BenchmarksInfoBadge({
  profile, school, anchor = 'right',
}: {
  profile: StudentProfile;
  school: School;
  anchor?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const lines = computeBenchmarks(profile, school);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  if (lines.length === 0) return null;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={popoverRef}>
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
        aria-label="See how you compare"
        title="See how you compare"
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: '1px solid #2DD4BF55',
          background: 'transparent',
          color: '#2DD4BF',
          fontSize: 10,
          fontWeight: 700,
          cursor: 'pointer',
          padding: 0,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        i
      </button>
      {open && (
        <div
          onClick={e => { e.stopPropagation(); }}
          style={{
            position: 'absolute',
            zIndex: 50,
            top: 'calc(100% + 6px)',
            [anchor]: 0,
            minWidth: 260,
            maxWidth: 320,
            background: '#0F1817',
            border: '1px solid #2DD4BF40',
            borderRadius: 10,
            padding: '10px 12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          }}
        >
          <div style={{ fontSize: 11, color: '#7A9E9B', marginBottom: 8, fontWeight: 600 }}>
            How you compare · {school.short ?? school.name}
          </div>
          <BenchmarksDisplay profile={profile} school={school} />
          <div style={{ marginTop: 8, fontSize: 9, color: '#4A6560' }}>
            Source: IPEDS 2024 + school CDS
          </div>
        </div>
      )}
    </div>
  );
}
