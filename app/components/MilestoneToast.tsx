'use client';

import { useEffect, useState } from 'react';
import { useMilestones } from '../lib/useMilestones';
import { useApp } from '../lib/context';
import { renderMilestone, MilestoneEvent } from '../lib/milestones';

const TOAST_DURATION_MS = 4500;

/**
 * Global mount: detects new milestones via the hook and shows them as
 * sliding toasts at the top. One at a time; queue empties one-per-cycle.
 */
export default function MilestoneToast() {
  const { newEvents, consumeNewEvent } = useMilestones();
  const { schools } = useApp();
  const [visible, setVisible] = useState<MilestoneEvent | null>(null);

  const schoolNameFor = (unitid: string): string | null => {
    return schools.find(s => s.unitid === unitid)?.short
      ?? schools.find(s => s.unitid === unitid)?.name
      ?? null;
  };

  // If nothing is visible and queue has events, dequeue the oldest
  useEffect(() => {
    if (visible) return;
    if (newEvents.length === 0) return;
    const next = newEvents[0];
    setVisible(next);
    const t = setTimeout(() => {
      consumeNewEvent(next.id);
      setVisible(null);
    }, TOAST_DURATION_MS);
    return () => clearTimeout(t);
  }, [visible, newEvents, consumeNewEvent]);

  if (!visible) return null;

  const rendered = renderMilestone(visible, { schoolNameFor });

  return (
    <div
      onClick={() => { consumeNewEvent(visible.id); setVisible(null); }}
      style={{
        position: 'fixed',
        top: 'max(16px, env(safe-area-inset-top, 16px))',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 200,
        padding: '0 16px',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          background: 'linear-gradient(135deg, #1A4540 0%, #0F1817 100%)',
          border: '1px solid #2DD4BF55',
          borderRadius: 14,
          padding: '12px 16px',
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          animation: 'milestoneSlide 0.35s ease-out',
          cursor: 'pointer',
        }}
      >
        <div style={{ fontSize: 26, flexShrink: 0 }}>{rendered.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#F0FAFA',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {rendered.title}
          </div>
          {rendered.subtitle && (
            <div style={{ fontSize: 11, color: '#7A9E9B', marginTop: 1 }}>
              {rendered.subtitle}
            </div>
          )}
        </div>
        <div style={{ fontSize: 14, color: '#4A6560', flexShrink: 0 }}>✕</div>
      </div>
      <style>{`
        @keyframes milestoneSlide {
          from { transform: translateY(-12px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
