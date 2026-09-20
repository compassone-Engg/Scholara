'use client';

import Link from 'next/link';
import { School } from '../lib/types';
import { MatchResult } from '../lib/types';
import { chanceBand } from '../lib/chanceBand';

interface SchoolCardProps {
  school: School;
  result: MatchResult;
}

const CATEGORY_CONFIG = {
  safety: { label: 'Safety', color: '#4ADE80', badgeClass: 'badge-safety' },
  match: { label: 'Match', color: '#2DD4BF', badgeClass: 'badge-match' },
  reach: { label: 'Reach', color: '#FACC15', badgeClass: 'badge-reach' },
  far_reach: { label: 'Far Reach', color: '#F87171', badgeClass: 'badge-far_reach' },
};

export default function SchoolCard({ school, result }: SchoolCardProps) {
  const cat = CATEGORY_CONFIG[result.matchCategory];

  return (
    <Link href={`/schools/${school.unitid}`} style={{ textDecoration: 'none' }}>
      <div
        style={{
          background: '#111918',
          border: '1px solid #1E302E',
          borderRadius: 12,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          transition: 'background 0.15s, border-color 0.15s',
          cursor: 'pointer',
        }}
      >
        {/* School initial avatar */}
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: `${cat.color}18`,
          border: `1px solid ${cat.color}30`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: 16,
          fontWeight: 700,
          color: cat.color,
        }}>
          {school.short.charAt(0)}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#F0FAFA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {school.name}
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: cat.color, flexShrink: 0 }}>
              {chanceBand(result.estimatedChance)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
            <span className={cat.badgeClass} style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 6 }}>
              {cat.label}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
