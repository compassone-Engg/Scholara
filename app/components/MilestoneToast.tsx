'use client';

import { useEffect, useState } from 'react';
import { useMilestones } from '../lib/useMilestones';
import { useApp } from '../lib/context';
import { renderMilestone, MilestoneEvent } from '../lib/milestones';

const TOAST_DURATION_MS = 4500;

/**
 * Global mount: detects new milestones via the hook and shows them as
 * sliding toasts at the top. Milestones detected in the same pass (e.g.
 * several schools moving up a category from one profile edit) are grouped
 * into a single combined toast instead of being strung out one after
 * another; separate batches still display one at a time.
 */
export default function MilestoneToast() {
  const { newBatches, consumeOldestBatch } = useMilestones();
  const { schools } = useApp();
  const [visibleBatch, setVisibleBatch] = useState<MilestoneEvent[] | null>(null);

  const schoolNameFor = (unitid: string): string | null => {
    return schools.find(s => s.unitid === unitid)?.short
      ?? schools.find(s => s.unitid === unitid)?.name
      ?? null;
  };

  // If nothing is visible and the queue has a batch waiting, dequeue the oldest one.
  useEffect(() => {
    if (visibleBatch) return;
    if (newBatches.length === 0) return;
    const next = newBatches[0];
    setVisibleBatch(next);
    const t = setTimeout(() => {
      consumeOldestBatch();
      setVisibleBatch(null);
    }, TOAST_DURATION_MS);
    return () => clearTimeout(t);
  }, [visibleBatch, newBatches, consumeOldestBatch]);

  if (!visibleBatch) return null;

  const dismiss = () => {
    consumeOldestBatch();
    setVisibleBatch(null);
  };

  let emoji: string;
  let title: string;
  let subtitle: string | undefined;

  if (visibleBatch.length === 1) {
    const rendered = renderMilestone(visibleBatch[0], { schoolNameFor });
    emoji = rendered.emoji;
    title = rendered.title;
    subtitle = rendered.subtitle;
  } else {
    // Several milestones fired from the same change — group them into one
    // toast rather than queuing them to show one after another.
    const titles = visibleBatch.map(e => renderMilestone(e, { schoolNameFor }).title);
    const shown = titles.slice(0, 2);
    const extra = titles.length - shown.length;
    emoji = '🎉';
    title = `${visibleBatch.length} updates just landed`;
    subtitle = shown.join(' · ') + (extra > 0 ? ` · +${extra} more` : '');
  }

  return (
    <div
      onClick={dismiss}
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
        <div style={{ fontSize: 26, flexShrink: 0 }}>{emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#F0FAFA',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {title}
          </div>
          {subtitle && (
            <div style={{
              fontSize: 11,
              color: '#7A9E9B',
              marginTop: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {subtitle}
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
