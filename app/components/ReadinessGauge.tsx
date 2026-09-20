'use client';

interface ReadinessGaugeProps {
  score: number;
  size?: number;
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Strong';
  if (score >= 50) return 'Good — Keep going';
  if (score >= 35) return 'Building momentum';
  return 'Early stages';
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#4ADE80';
  if (score >= 65) return '#2DD4BF';
  if (score >= 50) return '#2DD4BF';
  if (score >= 35) return '#FACC15';
  return '#F87171';
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export default function ReadinessGauge({ score, size = 120 }: ReadinessGaugeProps) {
  const color = getScoreColor(score);
  const label = getScoreLabel(score);

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - 20) / 2;

  // Arc goes from 135deg to 405deg (270deg sweep = 75% of circle)
  const arcStart = 135;
  const arcEnd = 405;
  const totalSweep = arcEnd - arcStart; // 270

  // Progress endpoint based on score
  const progressEnd = arcStart + (score / 100) * totalSweep;

  const bgPath = describeArc(cx, cy, r, arcStart, arcEnd - 0.5);
  const fgPath = score > 0 ? describeArc(cx, cy, r, arcStart, Math.min(progressEnd, arcEnd - 0.5)) : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} overflow="visible">
          {/* Background track */}
          <path
            d={bgPath}
            fill="none"
            stroke="#1E302E"
            strokeWidth={7}
            strokeLinecap="round"
          />
          {/* Progress */}
          {fgPath && (
            <path
              d={fgPath}
              fill="none"
              stroke={color}
              strokeWidth={7}
              strokeLinecap="round"
              style={{
                filter: `drop-shadow(0 0 4px ${color}80)`,
                transition: 'stroke 0.4s ease',
              }}
            />
          )}
        </svg>

        {/* Center text */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: size * 0.06,
        }}>
          <span style={{
            fontSize: size * 0.26,
            fontWeight: 800,
            color,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {score}
          </span>
          <span style={{ fontSize: size * 0.095, color: '#4A6560', marginTop: 1 }}>/ 100</span>
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#7A9E9B', textAlign: 'center', fontWeight: 500 }}>{label}</div>
    </div>
  );
}
