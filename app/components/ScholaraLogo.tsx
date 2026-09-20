import React from 'react';

/**
 * GraduationCap — simple mortarboard SVG in brand teal.
 * Scales via `size` prop (default 24).
 */
export function GraduationCap({ size = 24, color = '#2DD4BF' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Board / flat top */}
      <polygon
        points="16,4 30,11 16,18 2,11"
        fill={color}
      />
      {/* Cap body — cylinder below board */}
      <path
        d="M8 14v7c0 2.8 3.6 5 8 5s8-2.2 8-5v-7l-8 4-8-4z"
        fill={color}
        opacity="0.85"
      />
      {/* Tassel stem */}
      <line
        x1="30"
        y1="11"
        x2="30"
        y2="20"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Tassel end */}
      <circle cx="30" cy="21" r="1.8" fill={color} />
    </svg>
  );
}

/**
 * Full Scholara logo: graduation cap + wordmark side by side.
 * Use `size` to scale (default 24 = cap height).
 */
export function ScholaraWordmark({ size = 24 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(size * 0.33) }}>
      <GraduationCap size={size} />
      <span
        style={{
          fontSize: Math.round(size * 0.8),
          fontWeight: 800,
          background: 'linear-gradient(135deg, #2DD4BF, #0EA5E9)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-0.01em',
          lineHeight: 1,
        }}
      >
        Scholara
      </span>
    </div>
  );
}
