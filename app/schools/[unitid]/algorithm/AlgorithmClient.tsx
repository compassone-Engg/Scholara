'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '../../../lib/context';
import BottomNav from '../../../components/BottomNav';
import schoolsData from '../../../../data/schools.json';
import { School, StudentProfile, Activity, APCourse } from '../../../lib/types';
import { calculateMatch } from '../../../lib/algorithm';
import { BenchmarksDisplay } from '../../../components/Benchmarks';
import { computeBenchmarks } from '../../../lib/benchmarks';
import { chanceBand } from '../../../lib/chanceBand';

const schools = schoolsData as School[];

const CATEGORY_CONFIG = {
  safety: { label: 'Safety', color: '#4ADE80' },
  match: { label: 'Match', color: '#2DD4BF' },
  reach: { label: 'Reach', color: '#FACC15' },
  far_reach: { label: 'Far Reach', color: '#F87171' },
};

// ─── What If State ─────────────────────────────────────────────────────────────

interface WhatIfState {
  gpa: number;
  satScore: number | null;
  actScore: number | null;
  additionalAPs: number;
  additionalActivities: number;
  additionalActivitiesLeadership: boolean;
  appType: 'ed' | 'ea' | 'rd';
  testMode: 'auto' | 'sat_only' | 'act_only';
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#111918',
      border: '1px solid #1E302E',
      borderRadius: 16,
      padding: '16px',
      marginBottom: 14,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  weight,
}: {
  icon: string;
  title: string;
  weight: number;
  // Component score retained as a prop for backward compat — no longer displayed.
  // We removed the 0-100 component score from student-facing UI; the sticky bar
  // at the top of the page communicates the overall outcome.
  score?: number;
  whatIfScore?: number;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#F0FAFA' }}>{title}</span>
      </div>
      {weight > 0 ? (
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#F0FAFA', lineHeight: 1 }}>
            {Math.round(weight * 100)}%
          </div>
          <div style={{ fontSize: 10, color: '#7A9E9B', marginTop: 4 }}>weight at this school</div>
        </div>
      ) : null}
    </div>
  );
}

function ScoreBar({ value, color = '#2DD4BF', height = 8 }: { value: number; color?: string; height?: number }) {
  return (
    <div style={{ height, background: '#1E302E', borderRadius: height / 2, overflow: 'hidden' }}>
      <div style={{
        height: '100%',
        width: `${Math.min(100, Math.max(0, value))}%`,
        background: `linear-gradient(90deg, ${color}80, ${color})`,
        borderRadius: height / 2,
        transition: 'width 0.4s ease',
      }} />
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid #1A2826', marginBottom: 8 }}>
      <span style={{ fontSize: 13, color: '#7A9E9B' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: highlight ? '#2DD4BF' : '#F0FAFA' }}>{value}</span>
    </div>
  );
}

function InfoBox({ children, color = '#2DD4BF' }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{
      background: `${color}0D`,
      border: `1px solid ${color}25`,
      borderRadius: 8,
      padding: '10px 12px',
      marginTop: 10,
      fontSize: 12,
      color,
      lineHeight: 1.5,
    }}>
      {children}
    </div>
  );
}

// ─── What If Slider ───────────────────────────────────────────────────────────

function WhatIfSlider({
  label,
  value,
  min,
  max,
  step,
  currentLabel,
  whatIfLabel,
  onChange,
  formatValue,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  currentLabel: string;
  whatIfLabel: string;
  onChange: (v: number) => void;
  formatValue?: (v: number) => string;
}) {
  const fmt = formatValue || ((v: number) => String(v));

  return (
    <div style={{
      background: '#0D1A18',
      border: '1px solid #2DD4BF30',
      borderRadius: 10,
      padding: '12px',
      marginTop: 10,
      marginBottom: 6,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#2DD4BF', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        What If: {label}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
        <div style={{ fontSize: 11, color: '#7A9E9B' }}>
          Current: <span style={{ color: '#D4F0EE', fontWeight: 600 }}>{currentLabel}</span>
        </div>
        <div style={{ fontSize: 11, color: '#2DD4BF' }}>
          What If: <span style={{ fontWeight: 700 }}>{whatIfLabel}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          height: 44,
          appearance: 'none',
          WebkitAppearance: 'none',
          background: 'transparent',
          cursor: 'pointer',
          margin: 0,
          padding: '14px 0',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#7A9E9B', marginTop: -4 }}>
        <span>{fmt(min)}</span>
        <span>{fmt(max)}</span>
      </div>
    </div>
  );
}

// ─── GPA Section ─────────────────────────────────────────────────────────────

function GpaSection({
  gpa,
  school,
  score,
  weight,
  whatIfMode,
  whatIfGpa,
  whatIfScore,
  onWhatIfGpaChange,
}: {
  gpa: number;
  school: School;
  score: number;
  weight: number;
  whatIfMode: boolean;
  whatIfGpa: number;
  whatIfScore?: number;
  onWhatIfGpaChange: (v: number) => void;
}) {
  const displayGpa = whatIfMode ? whatIfGpa : gpa;

  const bands = [
    { key: '<3.25', label: '< 3.25', min: 0, max: 3.25 },
    { key: '3.25-3.49', label: '3.25–3.49', min: 3.25, max: 3.5 },
    { key: '3.5-3.74', label: '3.50–3.74', min: 3.5, max: 3.75 },
    { key: '3.75-4.0', label: '3.75–4.0', min: 3.75, max: 4.0 },
    { key: '>4.0', label: '> 4.0 (weighted)', min: 4.0, max: 5.0 },
  ];

  const getStudentBandKey = (g: number) => g >= 4.0 ? '>4.0'
    : g >= 3.75 ? '3.75-4.0'
    : g >= 3.5 ? '3.5-3.74'
    : g >= 3.25 ? '3.25-3.49'
    : '<3.25';

  const studentBandKey = getStudentBandKey(displayGpa);
  const realBandKey = getStudentBandKey(gpa);

  let cumulativeBelow = 0;
  for (const band of bands) {
    const pct = (school.gpa_bands[band.key] || 0) / 100;
    if (displayGpa >= band.max) {
      cumulativeBelow += pct;
    } else if (displayGpa >= band.min && displayGpa < band.max) {
      const bandWidth = band.max - band.min;
      const posInBand = bandWidth > 0 ? (displayGpa - band.min) / bandWidth : 0.5;
      cumulativeBelow += pct * posInBand;
      break;
    }
  }
  const percentile = Math.round(Math.min(100, Math.max(0, cumulativeBelow * 100)));

  return (
    <SectionCard>
      <SectionTitle icon="📚" title="GPA" score={score} weight={weight} whatIfScore={whatIfMode ? whatIfScore : undefined} />

      <Row label="Your unweighted GPA" value={whatIfMode ? `${gpa.toFixed(2)} → ${whatIfGpa.toFixed(2)}` : gpa.toFixed(2)} highlight />
      <Row label="School's importance rating" value={school.factor_labels.gpa} />

      {whatIfMode && (
        <WhatIfSlider
          label="GPA"
          value={whatIfGpa}
          min={2.0}
          max={4.0}
          step={0.05}
          currentLabel={gpa.toFixed(2)}
          whatIfLabel={whatIfGpa.toFixed(2)}
          onChange={onWhatIfGpaChange}
          formatValue={v => v.toFixed(1)}
        />
      )}

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#7A9E9B', marginBottom: 8 }}>Admitted Student GPA Distribution</div>
        {bands.map(band => {
          const pct = school.gpa_bands[band.key] || 0;
          const isStudentBand = band.key === studentBandKey;
          const isRealBand = whatIfMode && band.key === realBandKey && realBandKey !== studentBandKey;
          const barColor = isStudentBand ? '#2DD4BF' : '#1E302E';
          const fillColor = isStudentBand ? '#2DD4BF' : isRealBand ? '#7A9E9B40' : '#2A4442';
          return (
            <div key={band.key} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  fontSize: 11,
                  color: isStudentBand ? '#2DD4BF' : isRealBand ? '#7A9E9B' : '#7A9E9B',
                  fontWeight: isStudentBand ? 700 : 400,
                  width: 90,
                  flexShrink: 0,
                }}>
                  {band.label}
                </div>
                <div style={{ flex: 1, height: 16, background: '#1A2826', borderRadius: 4, overflow: 'hidden', position: 'relative', border: isStudentBand ? `1px solid ${barColor}60` : isRealBand ? '1px dashed #7A9E9B40' : '1px solid transparent' }}>
                  <div style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: fillColor,
                    borderRadius: 4,
                    transition: 'background 0.3s ease',
                  }} />
                  {isStudentBand && (
                    <div style={{
                      position: 'absolute',
                      left: 4,
                      top: 0,
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: 9,
                      color: '#F0FAFA',
                      fontWeight: 700,
                    }}>
                      {whatIfMode ? '← What If' : '← You'}
                    </div>
                  )}
                  {isRealBand && (
                    <div style={{
                      position: 'absolute',
                      right: 4,
                      top: 0,
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: 9,
                      color: '#7A9E9B',
                    }}>
                      Current →
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 11, color: isStudentBand ? '#2DD4BF' : '#7A9E9B', width: 32, textAlign: 'right', fontWeight: isStudentBand ? 700 : 400 }}>
                  {pct}%
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <InfoBox color="#2DD4BF">
        {whatIfMode
          ? <>Simulated GPA of <strong>{whatIfGpa.toFixed(2)}</strong> places you in approximately the <strong>{percentile}th percentile</strong> of admitted students.</>
          : <>Your GPA places you in approximately the <strong>{percentile}th percentile</strong> of admitted students at this school.</>
        }
      </InfoBox>
    </SectionCard>
  );
}

// ─── Test Scores Section ─────────────────────────────────────────────────────

function TestSection({
  satScore,
  actScore,
  school,
  score,
  weight,
  whatIfMode,
  whatIfSat,
  whatIfAct,
  whatIfScore,
  testMode,
  onWhatIfSatChange,
  onWhatIfActChange,
  onTestModeChange,
}: {
  satScore: number | null;
  actScore: number | null;
  school: School;
  score: number;
  weight: number;
  whatIfMode: boolean;
  whatIfSat: number | null;
  whatIfAct: number | null;
  whatIfScore?: number;
  testMode: 'auto' | 'sat_only' | 'act_only';
  onWhatIfSatChange: (v: number) => void;
  onWhatIfActChange: (v: number) => void;
  onTestModeChange: (m: 'auto' | 'sat_only' | 'act_only') => void;
}) {
  const displaySat = whatIfMode ? whatIfSat : satScore;
  const displayAct = whatIfMode ? whatIfAct : actScore;

  const hasSAT = displaySat && displaySat > 400;
  const hasACT = displayAct && displayAct > 1;
  const noScore = !hasSAT && !hasACT;

  const calcSatPct = (s: number | null) => s && school.sat_25 && school.sat_75
    ? Math.round(Math.min(98, Math.max(2, ((s - 400) / 1200) * 100)))
    : null;

  const calcActPct = (a: number | null) => a && school.act_25 && school.act_75
    ? Math.round(Math.min(98, Math.max(2, ((a - 1) / 35) * 100)))
    : null;

  const satPct = calcSatPct(displaySat);
  const realSatPct = calcSatPct(satScore);
  const actPct = calcActPct(displayAct);
  const realActPct = calcActPct(actScore);

  const satP25Pct = school.sat_25 ? Math.round(((school.sat_25 - 400) / 1200) * 100) : null;
  const satP75Pct = school.sat_75 ? Math.round(((school.sat_75 - 400) / 1200) * 100) : null;
  const actP25Pct = school.act_25 ? Math.round(((school.act_25 - 1) / 35) * 100) : null;
  const actP75Pct = school.act_75 ? Math.round(((school.act_75 - 1) / 35) * 100) : null;

  const scoreColor = score >= 70 ? '#4ADE80' : score >= 50 ? '#2DD4BF' : score >= 35 ? '#FACC15' : '#F87171';

  // Default what-if sat to midpoint if not set
  const satSliderValue = whatIfSat ?? (school.sat_25 && school.sat_75 ? Math.round((school.sat_25 + school.sat_75) / 2 / 10) * 10 : 1100);
  const actSliderValue = whatIfAct ?? (school.act_25 && school.act_75 ? Math.round((school.act_25 + school.act_75) / 2) : 24);

  // Show the SAT/ACT submission picker only when the student has both — otherwise
  // there's nothing to pick between.
  const hasBoth = !!(satScore && satScore > 400 && actScore && actScore > 1);

  return (
    <SectionCard>
      <SectionTitle icon="📝" title="Test Scores" score={score} weight={weight} whatIfScore={whatIfMode ? whatIfScore : undefined} />

      {hasBoth && (
        <div style={{
          marginBottom: 14,
          padding: '10px 12px',
          background: '#0F1817',
          border: '1px solid #1E302E',
          borderRadius: 8,
        }}>
          <div style={{ fontSize: 11, color: '#7A9E9B', marginBottom: 6, lineHeight: 1.5 }}>
            <strong style={{ color: '#F0FAFA' }}>You entered both SAT and ACT.</strong> By default we
            use whichever helps you most — your <strong>higher percentile</strong> at this school
            (what you&apos;d actually submit). Override if you only plan to send one.
          </div>
          <div style={{ display: 'flex', gap: 0, marginTop: 6 }}>
            {([
              { value: 'auto', label: 'Auto (higher)' },
              { value: 'sat_only', label: 'SAT only' },
              { value: 'act_only', label: 'ACT only' },
            ] as const).map((opt, i, arr) => {
              const active = testMode === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => onTestModeChange(opt.value)}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
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
      )}

      {noScore && !whatIfMode ? (
        <>
          <Row label="SAT" value="Not submitted" />
          <Row label="ACT" value="Not submitted" />
          <InfoBox color="#FACC15">
            No test score submitted. Score treated as neutral ({score}/100) since this school is test-optional. At more selective schools, most admitted students do submit scores.
          </InfoBox>
        </>
      ) : (
        <>
          {/* SAT */}
          <div style={{ marginBottom: 14 }}>
            <Row
              label="Your SAT"
              value={
                whatIfMode
                  ? `${satScore ? String(satScore) : 'None'} → ${whatIfSat ? String(whatIfSat) : 'None'}`
                  : satScore ? String(satScore) : 'Not submitted'
              }
              highlight={!!hasSAT}
            />

            {whatIfMode && (
              <WhatIfSlider
                label="SAT Score"
                value={satSliderValue}
                min={400}
                max={1600}
                step={10}
                currentLabel={satScore ? String(satScore) : 'Not taken'}
                whatIfLabel={whatIfSat ? String(whatIfSat) : 'Not set'}
                onChange={onWhatIfSatChange}
              />
            )}

            {(hasSAT || (whatIfMode && satPct !== null)) && (
              <>
                <div style={{ fontSize: 12, color: '#7A9E9B', marginBottom: 6 }}>
                  Admitted range: {school.sat_25}–{school.sat_75} (25th–75th percentile)
                </div>
                <div style={{ position: 'relative', height: 20, marginBottom: 4 }}>
                  <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: 0, right: 0, height: 8, background: '#1A2826', borderRadius: 4 }} />
                  {satP25Pct !== null && satP75Pct !== null && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      left: `${satP25Pct}%`,
                      width: `${satP75Pct - satP25Pct}%`,
                      height: 8,
                      background: '#2DD4BF30',
                      borderRadius: 4,
                      border: '1px solid #2DD4BF40',
                    }} />
                  )}
                  {/* Real score dot (ghost) */}
                  {whatIfMode && realSatPct !== null && realSatPct !== satPct && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: `${realSatPct}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: 'transparent',
                      border: '2px solid #7A9E9B',
                      zIndex: 2,
                      transition: 'left 0.15s ease',
                    }} />
                  )}
                  {/* What-if / current dot */}
                  {satPct !== null && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: `${satPct}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: '#fff',
                      border: `2.5px solid ${scoreColor}`,
                      zIndex: 3,
                      transition: 'left 0.15s ease',
                    }} />
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#7A9E9B' }}>
                  <span>400</span>
                  <span style={{ color: '#2DD4BF80', fontSize: 10 }}>middle 50%</span>
                  <span>1600</span>
                </div>
                {displaySat && school.sat_25 && school.sat_75 && (
                  <div style={{ fontSize: 11, marginTop: 4, color: '#7A9E9B' }}>
                    {whatIfMode ? 'Simulated score is' : 'Your score is'}{' '}
                    <span style={{ color: displaySat >= school.sat_75 ? '#4ADE80' : displaySat >= school.sat_25 ? '#2DD4BF' : '#FACC15', fontWeight: 600 }}>
                      {displaySat >= school.sat_75 ? 'above the 75th percentile' : displaySat >= school.sat_25 ? 'within the middle 50%' : 'below the 25th percentile'}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ACT */}
          <div style={{ marginBottom: 8 }}>
            <Row
              label="Your ACT"
              value={
                whatIfMode
                  ? `${actScore ? String(actScore) : 'None'} → ${whatIfAct ? String(whatIfAct) : 'None'}`
                  : actScore ? String(actScore) : 'Not submitted'
              }
              highlight={!!hasACT}
            />

            {whatIfMode && (
              <WhatIfSlider
                label="ACT Score"
                value={actSliderValue}
                min={1}
                max={36}
                step={1}
                currentLabel={actScore ? String(actScore) : 'Not taken'}
                whatIfLabel={whatIfAct ? String(whatIfAct) : 'Not set'}
                onChange={onWhatIfActChange}
              />
            )}

            {(hasACT || (whatIfMode && actPct !== null)) && (
              <>
                <div style={{ fontSize: 12, color: '#7A9E9B', marginBottom: 6 }}>
                  Admitted range: {school.act_25}–{school.act_75} (25th–75th percentile)
                </div>
                <div style={{ position: 'relative', height: 20, marginBottom: 4 }}>
                  <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: 0, right: 0, height: 8, background: '#1A2826', borderRadius: 4 }} />
                  {actP25Pct !== null && actP75Pct !== null && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      left: `${actP25Pct}%`,
                      width: `${actP75Pct - actP25Pct}%`,
                      height: 8,
                      background: '#2DD4BF30',
                      borderRadius: 4,
                      border: '1px solid #2DD4BF40',
                    }} />
                  )}
                  {whatIfMode && realActPct !== null && realActPct !== actPct && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: `${realActPct}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: 'transparent',
                      border: '2px solid #7A9E9B',
                      zIndex: 2,
                      transition: 'left 0.15s ease',
                    }} />
                  )}
                  {actPct !== null && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: `${actPct}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: '#fff',
                      border: `2.5px solid ${scoreColor}`,
                      zIndex: 3,
                      transition: 'left 0.15s ease',
                    }} />
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#7A9E9B' }}>
                  <span>1</span>
                  <span style={{ color: '#2DD4BF80', fontSize: 10 }}>middle 50%</span>
                  <span>36</span>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </SectionCard>
  );
}

// ─── Course Rigor Section ────────────────────────────────────────────────────

function RigorSection({
  apCourses,
  ibProgram,
  honorsCount,
  school,
  score,
  weight,
  whatIfMode,
  additionalAPs,
  whatIfScore,
  onAdditionalAPsChange,
}: {
  apCourses: APCourse[];
  ibProgram: boolean;
  honorsCount: number;
  school: School;
  score: number;
  weight: number;
  whatIfMode: boolean;
  additionalAPs: number;
  whatIfScore?: number;
  onAdditionalAPsChange: (v: number) => void;
}) {
  const apTarget = school.selectivity === 'ultra_selective' ? 10
    : school.selectivity === 'highly_selective' ? 7
    : school.selectivity === 'selective' ? 5 : 3;

  const apCount = apCourses.length;
  const whatIfApCount = apCount + additionalAPs;
  const displayApCount = whatIfMode ? whatIfApCount : apCount;
  const apScoresHigh = apCourses.filter(c => c.score && c.score >= 4);

  return (
    <SectionCard>
      <SectionTitle icon="🎯" title="Course Rigor" score={score} weight={weight} whatIfScore={whatIfMode ? whatIfScore : undefined} />

      <Row label="Target AP courses for this tier" value={String(apTarget)} />
      <Row
        label="Your AP courses"
        value={whatIfMode && additionalAPs > 0 ? `${apCount} → ${whatIfApCount}` : String(apCount)}
        highlight={displayApCount >= apTarget}
      />
      {ibProgram && <Row label="IB Program" value="Yes (+15 pts)" highlight />}
      <Row label="Honors courses" value={String(honorsCount)} />

      {whatIfMode && (
        <WhatIfSlider
          label="Additional AP Courses"
          value={additionalAPs}
          min={0}
          max={5}
          step={1}
          currentLabel={`${apCount} total`}
          whatIfLabel={`+${additionalAPs} = ${whatIfApCount} total`}
          onChange={onAdditionalAPsChange}
        />
      )}

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#7A9E9B', marginBottom: 8 }}>
          AP Progress — {displayApCount}/{apTarget} toward target
        </div>
        <div style={{ position: 'relative' }}>
          <ScoreBar value={(displayApCount / apTarget) * 100} color="#2DD4BF" height={8} />
          {whatIfMode && additionalAPs > 0 && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: 8,
              width: `${Math.min(100, (apCount / apTarget) * 100)}%`,
              background: '#7A9E9B40',
              borderRadius: 4,
              pointerEvents: 'none',
            }} />
          )}
        </div>
      </div>

      {apCourses.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 12, color: '#7A9E9B', marginBottom: 8 }}>Your AP Courses</div>
          {apCourses.map((course, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '5px 0',
              borderBottom: '1px solid #1A2826',
            }}>
              <div>
                <span style={{ fontSize: 12, color: '#D4F0EE' }}>{course.name}</span>
                <span style={{ fontSize: 10, color: '#7A9E9B', marginLeft: 6 }}>
                  {course.status === 'in_progress' ? '(in progress)' : course.status === 'planned' ? '(planned)' : ''}
                </span>
              </div>
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: course.score && course.score >= 4 ? '#4ADE80' : course.score ? '#FACC15' : '#7A9E9B',
              }}>
                {course.score ? `Score: ${course.score}` : '—'}
              </span>
            </div>
          ))}
          {whatIfMode && additionalAPs > 0 && (
            Array.from({ length: additionalAPs }).map((_, i) => (
              <div key={`extra-${i}`} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '5px 0',
                borderBottom: '1px solid #1A2826',
                opacity: 0.7,
              }}>
                <div>
                  <span style={{ fontSize: 12, color: '#2DD4BF' }}>+ Simulated AP Course {i + 1}</span>
                  <span style={{ fontSize: 10, color: '#7A9E9B', marginLeft: 6 }}>(what if)</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#7A9E9B' }}>—</span>
              </div>
            ))
          )}
        </div>
      )}

      {apScoresHigh.length > 0 && (
        <InfoBox color="#4ADE80">
          {apScoresHigh.length} AP score{apScoresHigh.length > 1 ? 's' : ''} of 4 or 5 — demonstrates strong academic performance.
        </InfoBox>
      )}

      {displayApCount < apTarget && (
        <InfoBox color="#FACC15">
          {whatIfMode && additionalAPs > 0
            ? `With +${additionalAPs} simulated APs you'd have ${whatIfApCount}/${apTarget} — ${whatIfApCount >= apTarget ? 'hitting the target!' : `still ${apTarget - whatIfApCount} short of the target.`}`
            : `You have ${apCount} AP course${apCount !== 1 ? 's' : ''}. This school typically expects around ${apTarget} for your application to be competitive.`
          }
        </InfoBox>
      )}
    </SectionCard>
  );
}

// ─── Extracurriculars Section ────────────────────────────────────────────────

function EcSection({
  activities,
  awardsCount,
  school,
  score,
  weight,
  whatIfMode,
  additionalActivities,
  additionalActivitiesLeadership,
  whatIfScore,
  onAdditionalActivitiesChange,
  onLeadershipToggle,
}: {
  activities: Activity[];
  awardsCount: number;
  school: School;
  score: number;
  weight: number;
  whatIfMode: boolean;
  additionalActivities: number;
  additionalActivitiesLeadership: boolean;
  whatIfScore?: number;
  onAdditionalActivitiesChange: (v: number) => void;
  onLeadershipToggle: () => void;
}) {
  const importanceColors: Record<string, string> = {
    'Very Important': '#4ADE80',
    'Important': '#2DD4BF',
    'Considered': '#FACC15',
    'Not Considered': '#7A9E9B',
    'Not Used': '#7A9E9B',
  };
  const ecLabel = school.factor_labels.ec;
  const ecColor = importanceColors[ecLabel] || '#7A9E9B';
  const leadershipCount = activities.filter(a => a.leadership).length;
  const displayCount = whatIfMode ? activities.length + additionalActivities : activities.length;
  const displayLeadership = whatIfMode
    ? leadershipCount + (additionalActivitiesLeadership && additionalActivities > 0 ? additionalActivities : 0)
    : leadershipCount;

  return (
    <SectionCard>
      <SectionTitle icon="🏆" title="Extracurriculars" score={score} weight={weight} whatIfScore={whatIfMode ? whatIfScore : undefined} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '8px 10px', background: `${ecColor}10`, borderRadius: 8, border: `1px solid ${ecColor}25` }}>
        <span style={{ fontSize: 12, color: '#7A9E9B' }}>This school rates ECs as</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: ecColor }}>{ecLabel}</span>
      </div>

      <Row
        label="Activities listed"
        value={whatIfMode && additionalActivities > 0 ? `${activities.length} → ${displayCount}` : String(activities.length)}
      />
      <Row
        label="With leadership roles"
        value={whatIfMode && additionalActivities > 0 && additionalActivitiesLeadership
          ? `${leadershipCount} → ${displayLeadership}`
          : String(leadershipCount)
        }
        highlight={displayLeadership > 0}
      />
      <Row label="Awards & honors" value={String(awardsCount)} />

      {whatIfMode && (
        <div style={{
          background: '#0D1A18',
          border: '1px solid #2DD4BF30',
          borderRadius: 10,
          padding: '12px',
          marginTop: 10,
          marginBottom: 6,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#2DD4BF', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            What If: Activities
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: '#7A9E9B' }}>
              Current: <span style={{ color: '#D4F0EE', fontWeight: 600 }}>{activities.length} activities</span>
            </div>
            <div style={{ fontSize: 11, color: '#2DD4BF' }}>
              What If: <span style={{ fontWeight: 700 }}>+{additionalActivities} = {displayCount}</span>
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={3}
            step={1}
            value={additionalActivities}
            onChange={e => onAdditionalActivitiesChange(Number(e.target.value))}
            style={{
              width: '100%',
              height: 44,
              appearance: 'none',
              WebkitAppearance: 'none',
              background: 'transparent',
              cursor: 'pointer',
              margin: 0,
              padding: '14px 0',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#7A9E9B', marginTop: -4, marginBottom: 10 }}>
            <span>+0</span>
            <span>+1</span>
            <span>+2</span>
            <span>+3</span>
          </div>
          {additionalActivities > 0 && (
            <button
              onClick={onLeadershipToggle}
              style={{
                width: '100%',
                minHeight: 44,
                background: additionalActivitiesLeadership ? '#FACC1515' : '#1A2826',
                border: additionalActivitiesLeadership ? '1px solid #FACC1540' : '1px solid #2A3A38',
                borderRadius: 8,
                color: additionalActivitiesLeadership ? '#FACC15' : '#7A9E9B',
                fontSize: 12,
                fontWeight: additionalActivitiesLeadership ? 700 : 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '0 12px',
              }}
            >
              <span style={{ fontSize: 14 }}>{additionalActivitiesLeadership ? '✓' : '+'}</span>
              Include leadership roles in simulated activities
            </button>
          )}
        </div>
      )}

      {activities.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 12, color: '#7A9E9B', marginBottom: 8 }}>Your Activities</div>
          {activities.map((act, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 0',
              borderBottom: '1px solid #1A2826',
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, color: '#D4F0EE', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{act.name}</div>
                <div style={{ fontSize: 10, color: '#7A9E9B', marginTop: 1 }}>{act.category}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                {act.leadership && (
                  <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: '#FACC1515', color: '#FACC15', fontWeight: 600 }}>
                    Leader
                  </span>
                )}
                <span style={{ fontSize: 10, color: '#7A9E9B' }}>{act.hoursPerWeek}h/wk</span>
              </div>
            </div>
          ))}
          {whatIfMode && additionalActivities > 0 && Array.from({ length: additionalActivities }).map((_, i) => (
            <div key={`extra-act-${i}`} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 0',
              borderBottom: '1px solid #1A2826',
              opacity: 0.75,
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, color: '#2DD4BF' }}>+ Simulated Activity {i + 1}</div>
                <div style={{ fontSize: 10, color: '#7A9E9B', marginTop: 1 }}>(what if)</div>
              </div>
              {additionalActivitiesLeadership && (
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: '#FACC1515', color: '#FACC15', fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>
                  Leader
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {activities.length === 0 && !whatIfMode && (
        <InfoBox color="#F87171">
          No activities listed. Adding extracurriculars — especially with leadership — significantly strengthens your application.
        </InfoBox>
      )}
    </SectionCard>
  );
}

// ─── Bonuses Section ─────────────────────────────────────────────────────────

function BonusesSection({
  appType,
  isLegacy,
  isFirstGen,
  whatIfMode,
  whatIfAppType,
  onAppTypeChange,
  whatIfProfile,
  school,
  testMode,
}: {
  appType: string;
  isLegacy: boolean;
  isFirstGen: boolean;
  whatIfMode: boolean;
  whatIfAppType: 'ed' | 'ea' | 'rd';
  onAppTypeChange: (v: 'ed' | 'ea' | 'rd') => void;
  whatIfProfile: StudentProfile;
  school: School;
  testMode: 'auto' | 'sat_only' | 'act_only';
}) {
  const displayAppType = whatIfMode ? whatIfAppType : appType;

  const bonuses: { label: string; color: string }[] = [];
  if (displayAppType === 'ed') bonuses.push({ label: 'Early Decision boost', color: '#4ADE80' });
  else if (displayAppType === 'ea') bonuses.push({ label: 'Early Action boost', color: '#2DD4BF' });
  if (isLegacy) bonuses.push({ label: 'Legacy connection', color: '#A78BFA' });
  if (isFirstGen) bonuses.push({ label: 'First-generation student', color: '#FB923C' });

  // Compute chance for each app type at this school with the current What-If profile.
  // RD is the baseline; EA/ED show how much they lift above RD.
  const chanceRD = calculateMatch(whatIfProfile, school, 'rd', testMode).estimatedChance;
  const chanceEA = calculateMatch(whatIfProfile, school, 'ea', testMode).estimatedChance;
  const chanceED = calculateMatch(whatIfProfile, school, 'ed', testMode).estimatedChance;

  // Round delta to nearest 5pp. Floor to ≈+5% when underlying delta is positive
  // but rounds to 0, so the student doesn't read "≈+0%" as "no effect."
  const roundDelta = (delta: number): number => {
    if (delta <= 0) return 0;
    const rounded = Math.round(delta / 5) * 5;
    return rounded === 0 ? 5 : rounded;
  };
  const deltaEA = roundDelta(chanceEA - chanceRD);
  const deltaED = roundDelta(chanceED - chanceRD);

  // Label builder. Three states:
  //   1. RD baseline → just the band
  //   2. EA/ED with no further lift (already at cap) → "no extra lift — already strong"
  //   3. EA/ED with lift → "≈+X% → <band>"
  // (No negative deltas — bonuses can't reduce chance in this model.)
  const buildLabel = (kind: 'rd' | 'ea' | 'ed'): string => {
    if (kind === 'rd') return chanceBand(chanceRD);
    const chance = kind === 'ea' ? chanceEA : chanceED;
    const delta = kind === 'ea' ? deltaEA : deltaED;
    const sameBand = chanceBand(chance) === chanceBand(chanceRD);
    if (delta === 0 && sameBand) return 'no extra lift';
    return `+${delta}% → ${chanceBand(chance)}`;
  };

  const OPTIONS: { value: 'ed' | 'ea' | 'rd'; short: string; label: string }[] = [
    { value: 'rd', short: 'RD', label: 'Regular' },
    { value: 'ea', short: 'EA', label: 'Early Action' },
    { value: 'ed', short: 'ED', label: 'Early Decision' },
  ];

  return (
    <SectionCard>
      <SectionTitle icon="✨" title="Bonuses" weight={0} />

      {whatIfMode && (
        <div style={{
          background: '#0D1A18',
          border: '1px solid #2DD4BF30',
          borderRadius: 10,
          padding: '12px',
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#2DD4BF', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            What If: Application Type
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {OPTIONS.map(opt => {
              const isActive = whatIfAppType === opt.value;
              const labelText = buildLabel(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => onAppTypeChange(opt.value)}
                  style={{
                    flex: 1,
                    minHeight: 78,
                    background: isActive ? '#2DD4BF15' : '#1A2826',
                    border: isActive ? '1px solid #2DD4BF50' : '1px solid #2A3A38',
                    borderRadius: 8,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    padding: '8px 4px',
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? '#2DD4BF' : '#F0FAFA' }}>{opt.short}</span>
                  <span style={{ fontSize: 9, color: isActive ? '#2DD4BF80' : '#7A9E9B' }}>{opt.label}</span>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: isActive ? '#4ADE80' : '#F0FAFA',
                    marginTop: 4,
                    textAlign: 'center',
                    lineHeight: 1.3,
                    whiteSpace: 'nowrap',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {labelText}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {bonuses.length === 0 ? (
        <div style={{ fontSize: 13, color: '#7A9E9B', paddingBottom: 4 }}>
          No bonus factors apply. {whatIfMode ? 'Select EA or ED above to simulate a bonus.' : 'Applying ED or being a legacy/first-gen student can lift your chances.'}
        </div>
      ) : (
        bonuses.map(b => (
          <div key={b.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '6px 10px', background: `${b.color}0D`, borderRadius: 8 }}>
            <span style={{ fontSize: 13, color: b.color }}>{b.label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: b.color }}>active</span>
          </div>
        ))
      )}
      <div style={{ fontSize: 11, color: '#7A9E9B', marginTop: 4 }}>
        Bonus impact varies by school — the deltas above are computed against your current What-If profile.
      </div>
    </SectionCard>
  );
}

// ─── Final Calculation ────────────────────────────────────────────────────────

function FinalSection({
  gpaScore,
  testScore,
  rigorScore,
  ecScore,
  gpaWeight,
  testWeight,
  rigorWeight,
  ecWeight,
  appType,
  isLegacy,
  isFirstGen,
  matchScore,
  estimatedChance,
  category,
  color,
  school,
  whatIfMode,
  whatIfResult,
  whatIfAppType,
}: {
  gpaScore: number;
  testScore: number;
  rigorScore: number;
  ecScore: number;
  gpaWeight: number;
  testWeight: number;
  rigorWeight: number;
  ecWeight: number;
  appType: string;
  isLegacy: boolean;
  isFirstGen: boolean;
  matchScore: number;
  estimatedChance: number;
  category: string;
  color: string;
  school: School;
  whatIfMode: boolean;
  whatIfResult?: ReturnType<typeof calculateMatch>;
  whatIfAppType: 'ed' | 'ea' | 'rd';
}) {
  const appBonus = appType === 'ed' ? 12 : appType === 'ea' ? 4 : 0;
  const legacyBonus = isLegacy ? 8 : 0;
  const firstGenBonus = isFirstGen ? 2 : 0;
  const totalBonus = appBonus + legacyBonus + firstGenBonus;

  const wiAppBonus = whatIfAppType === 'ed' ? 12 : whatIfAppType === 'ea' ? 4 : 0;
  const wiTotalBonus = wiAppBonus + legacyBonus + firstGenBonus;

  const remainingWeight = 1 - gpaWeight - testWeight - rigorWeight - ecWeight;
  const neutralBaseline = Math.round(Math.max(0, remainingWeight) * 50);

  const catConfig = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG] || { label: category, color: '#7A9E9B' };

  const wiScore = whatIfResult?.matchScore ?? matchScore;
  const wiChance = whatIfResult?.estimatedChance ?? estimatedChance;
  const wiCategory = whatIfResult?.matchCategory ?? (category as keyof typeof CATEGORY_CONFIG);
  const wiCatConfig = CATEGORY_CONFIG[wiCategory] || { label: wiCategory, color: '#7A9E9B' };
  const wiComps = whatIfResult?.components ?? { gpa: gpaScore, test: testScore, rigor: rigorScore, ec: ecScore };

  const scoreDelta = wiScore - matchScore;
  const chanceDelta = wiChance - estimatedChance;

  return (
    <SectionCard>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#F0FAFA', marginBottom: 14 }}>Your Result</div>

      {/* The component-score × weight formula breakdown lived here previously.
          Removed because component scores (0-100) are no longer student-facing.
          The sticky bar at the top of the page shows the headline chance band,
          and each component card above gives the relevant context. The block
          below is kept hidden so the JSX tree remains balanced without a
          larger refactor. */}
      <div style={{ display: 'none' }}>
      <div style={{
        background: '#0A0F0E',
        border: '1px solid #1E302E',
        borderRadius: 10,
        padding: '14px',
        marginBottom: 14,
        fontFamily: 'monospace',
        fontSize: 11,
        lineHeight: 2,
        color: '#7A9E9B',
        overflowX: 'auto',
      }}>
        <div style={{ color: '#7A9E9B', marginBottom: 4, fontSize: 10 }}>// Weighted component scores (0–100 each)</div>

        {whatIfMode ? (
          /* ── Two-row formula: Current vs What If ── */
          <>
            {/* Header row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 4, borderBottom: '1px solid #1E302E', paddingBottom: 4 }}>
              <div style={{ width: 50, fontSize: 9, color: '#4A6A68', textTransform: 'uppercase' }}></div>
              <div style={{ flex: 1, fontSize: 9, color: '#7A9E9B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current</div>
              <div style={{ flex: 1, fontSize: 9, color: '#2DD4BF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>What If</div>
            </div>
            {/* GPA row */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ width: 50, fontSize: 10, color: '#7A9E9B' }}>GPA</div>
              <div style={{ flex: 1, color: '#7A9E9B' }}>
                <span style={{ color: '#4ADE80' }}>{gpaScore}</span> × <span style={{ color: '#2DD4BF' }}>{Math.round(gpaWeight * 100)}%</span>
                {' = '}<span style={{ color: '#F0FAFA' }}>{(gpaScore * gpaWeight).toFixed(1)}</span>
              </div>
              <div style={{ flex: 1, color: '#2DD4BF' }}>
                <span style={{ color: '#4ADE80' }}>{wiComps.gpa}</span> × <span style={{ color: '#2DD4BF80' }}>{Math.round(gpaWeight * 100)}%</span>
                {' = '}<span style={{ color: '#F0FAFA' }}>{(wiComps.gpa * gpaWeight).toFixed(1)}</span>
              </div>
            </div>
            {/* Tests row */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ width: 50, fontSize: 10, color: '#7A9E9B' }}>Tests</div>
              <div style={{ flex: 1, color: '#7A9E9B' }}>
                <span style={{ color: '#4ADE80' }}>{testScore}</span> × <span style={{ color: '#2DD4BF' }}>{Math.round(testWeight * 100)}%</span>
                {' = '}<span style={{ color: '#F0FAFA' }}>{(testScore * testWeight).toFixed(1)}</span>
              </div>
              <div style={{ flex: 1, color: '#2DD4BF' }}>
                <span style={{ color: '#4ADE80' }}>{wiComps.test}</span> × <span style={{ color: '#2DD4BF80' }}>{Math.round(testWeight * 100)}%</span>
                {' = '}<span style={{ color: '#F0FAFA' }}>{(wiComps.test * testWeight).toFixed(1)}</span>
              </div>
            </div>
            {/* Rigor row */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ width: 50, fontSize: 10, color: '#7A9E9B' }}>Rigor</div>
              <div style={{ flex: 1, color: '#7A9E9B' }}>
                <span style={{ color: '#4ADE80' }}>{rigorScore}</span> × <span style={{ color: '#2DD4BF' }}>{Math.round(rigorWeight * 100)}%</span>
                {' = '}<span style={{ color: '#F0FAFA' }}>{(rigorScore * rigorWeight).toFixed(1)}</span>
              </div>
              <div style={{ flex: 1, color: '#2DD4BF' }}>
                <span style={{ color: '#4ADE80' }}>{wiComps.rigor}</span> × <span style={{ color: '#2DD4BF80' }}>{Math.round(rigorWeight * 100)}%</span>
                {' = '}<span style={{ color: '#F0FAFA' }}>{(wiComps.rigor * rigorWeight).toFixed(1)}</span>
              </div>
            </div>
            {/* ECs row */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ width: 50, fontSize: 10, color: '#7A9E9B' }}>ECs</div>
              <div style={{ flex: 1, color: '#7A9E9B' }}>
                <span style={{ color: '#4ADE80' }}>{ecScore}</span> × <span style={{ color: '#2DD4BF' }}>{Math.round(ecWeight * 100)}%</span>
                {' = '}<span style={{ color: '#F0FAFA' }}>{(ecScore * ecWeight).toFixed(1)}</span>
              </div>
              <div style={{ flex: 1, color: '#2DD4BF' }}>
                <span style={{ color: '#4ADE80' }}>{wiComps.ec}</span> × <span style={{ color: '#2DD4BF80' }}>{Math.round(ecWeight * 100)}%</span>
                {' = '}<span style={{ color: '#F0FAFA' }}>{(wiComps.ec * ecWeight).toFixed(1)}</span>
              </div>
            </div>
            {neutralBaseline > 0 && (
              <div style={{ color: '#7A9E9B' }}>
                Other factors (neutral): <span style={{ color: '#F0FAFA' }}>{neutralBaseline}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ width: 50, fontSize: 10, color: '#7A9E9B' }}>Bonus</div>
              <div style={{ flex: 1 }}>
                {totalBonus > 0
                  ? <span style={{ color: '#FACC15' }}>+{totalBonus}</span>
                  : <span style={{ color: '#4A6A68' }}>none</span>
                }
              </div>
              <div style={{ flex: 1 }}>
                {wiTotalBonus > 0
                  ? <span style={{ color: '#FACC15' }}>+{wiTotalBonus}</span>
                  : <span style={{ color: '#4A6A68' }}>none</span>
                }
              </div>
            </div>
            <div style={{ borderTop: '1px solid #1E302E', marginTop: 6, paddingTop: 6, display: 'flex', gap: 8 }}>
              <div style={{ width: 50 }}></div>
              <div style={{ flex: 1 }}>
                <strong style={{ color }}>{chanceBand(estimatedChance)}</strong>
                <span style={{ color: '#7A9E9B', marginLeft: 4 }}>chance</span>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                <strong style={{ color: wiCatConfig.color }}>{chanceBand(wiChance)}</strong>
                <span style={{ color: '#7A9E9B', marginLeft: 4 }}>chance</span>
              </div>
            </div>
          </>
        ) : (
          /* ── Single-row formula (read-only) ── */
          <>
            <div>
              GPA: <span style={{ color: '#4ADE80' }}>{gpaScore}</span>{' '}× <span style={{ color: '#2DD4BF' }}>{Math.round(gpaWeight * 100)}%</span>
              {' = '}<span style={{ color: '#F0FAFA' }}>{(gpaScore * gpaWeight).toFixed(1)}</span>
            </div>
            <div>
              Tests: <span style={{ color: '#4ADE80' }}>{testScore}</span>{' '}× <span style={{ color: '#2DD4BF' }}>{Math.round(testWeight * 100)}%</span>
              {' = '}<span style={{ color: '#F0FAFA' }}>{(testScore * testWeight).toFixed(1)}</span>
            </div>
            <div>
              Rigor: <span style={{ color: '#4ADE80' }}>{rigorScore}</span>{' '}× <span style={{ color: '#2DD4BF' }}>{Math.round(rigorWeight * 100)}%</span>
              {' = '}<span style={{ color: '#F0FAFA' }}>{(rigorScore * rigorWeight).toFixed(1)}</span>
            </div>
            <div>
              ECs: <span style={{ color: '#4ADE80' }}>{ecScore}</span>{' '}× <span style={{ color: '#2DD4BF' }}>{Math.round(ecWeight * 100)}%</span>
              {' = '}<span style={{ color: '#F0FAFA' }}>{(ecScore * ecWeight).toFixed(1)}</span>
            </div>
            {neutralBaseline > 0 && (
              <div style={{ color: '#7A9E9B' }}>
                Other factors (neutral): <span style={{ color: '#F0FAFA' }}>{neutralBaseline}</span>
              </div>
            )}
            {totalBonus > 0 && (
              <div>
                Bonuses: <span style={{ color: '#FACC15' }}>+{totalBonus}</span>
              </div>
            )}
            <div style={{ borderTop: '1px solid #1E302E', marginTop: 6, paddingTop: 6 }}>
              <strong style={{ color: color }}>Estimated chance: {chanceBand(estimatedChance)}</strong>
            </div>
          </>
        )}
      </div>
      </div>

      {/* Result cards — chance bands only, no exact percentages or match scores */}
      {whatIfMode ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          {/* Current */}
          <div style={{ background: `${color}10`, border: `1px solid ${color}25`, borderRadius: 12, padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#7A9E9B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current</div>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{chanceBand(estimatedChance)}</div>
            <div style={{ fontSize: 10, color: '#7A9E9B', marginTop: 2 }}>est. chance</div>
            <div style={{ fontSize: 12, fontWeight: 600, color, marginTop: 6 }}>{catConfig.label}</div>
          </div>
          {/* What If */}
          <div style={{ background: `${wiCatConfig.color}10`, border: `1px solid ${wiCatConfig.color}40`, borderRadius: 12, padding: '14px', textAlign: 'center', position: 'relative' }}>
            <div style={{ fontSize: 10, color: '#2DD4BF', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>What If</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: wiCatConfig.color }}>{chanceBand(wiChance)}</div>
            <div style={{ fontSize: 10, color: '#7A9E9B', marginTop: 2 }}>est. chance</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: wiCatConfig.color, marginTop: 6 }}>{wiCatConfig.label}</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ background: `${color}10`, border: `1px solid ${color}25`, borderRadius: 12, padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color }}>{chanceBand(estimatedChance)}</div>
            <div style={{ fontSize: 11, color: '#7A9E9B', marginTop: 2 }}>Est. Chance</div>
          </div>
          <div style={{ background: `${color}10`, border: `1px solid ${color}25`, borderRadius: 12, padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color }}>{catConfig.label}</div>
            <div style={{ fontSize: 11, color: '#7A9E9B', marginTop: 2 }}>Category</div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 10, padding: '10px 12px', background: `${catConfig.color}10`, border: `1px solid ${catConfig.color}25`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, color: '#7A9E9B' }}>Category</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: catConfig.color }}>{catConfig.label}</span>
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: '#7A9E9B', lineHeight: 1.6 }}>
        The estimated chance is anchored to this school&apos;s overall admission rate of{' '}
        <strong style={{ color: '#F0FAFA' }}>
          {school.acceptance_rate ? `${(school.acceptance_rate * 100).toFixed(1)}%` : 'N/A'}
        </strong>
        . Your match score adjusts that probability up or down based on how your profile compares to typical applicants.
      </div>
    </SectionCard>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AlgorithmClient({ unitid }: { unitid: string }) {
  const { matchResults, profile } = useApp();

  const school = useMemo(() => schools.find(s => s.unitid === unitid), [unitid]);
  const result = useMemo(() => matchResults.find(r => r.schoolUnitid === unitid), [matchResults, unitid]);

  // ─── What If State ─────────────────────────────────────────────────────────
  const [whatIfMode, setWhatIfMode] = useState(false);
  // Auto-enable what-if when arriving via ?whatif=1 (from the School Detail page's "What If" button).
  // We use useEffect so the state actually updates after hydration; useState's initial value would
  // be locked to false from SSR/static prerender.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('whatif') === '1') {
      setWhatIfMode(true);
    }
  }, []);

  const defaultWhatIf = useMemo<WhatIfState>(() => ({
    gpa: profile.gpaUnweighted,
    satScore: profile.satScore,
    actScore: profile.actScore,
    additionalAPs: 0,
    additionalActivities: 0,
    additionalActivitiesLeadership: false,
    appType: 'rd',
    testMode: 'auto' as const,
  }), [profile]);

  const [whatIf, setWhatIf] = useState<WhatIfState>(defaultWhatIf);

  // Debounce ref for slider changes
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingWhatIf, setPendingWhatIf] = useState<WhatIfState>(defaultWhatIf);

  // Reset what-if when mode toggled off, or when profile changes
  useEffect(() => {
    const fresh = {
      gpa: profile.gpaUnweighted,
      satScore: profile.satScore,
      actScore: profile.actScore,
      additionalAPs: 0,
      additionalActivities: 0,
      additionalActivitiesLeadership: false,
      appType: 'rd' as const,
      testMode: 'auto' as const,
    };
    setWhatIf(fresh);
    setPendingWhatIf(fresh);
  }, [profile]);

  // Debounced update: pending → committed
  const updateWhatIf = useCallback((updates: Partial<WhatIfState>) => {
    setPendingWhatIf(prev => ({ ...prev, ...updates }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setWhatIf(prev => ({ ...prev, ...updates }));
    }, 80);
  }, []);

  // Build modified profile for what-if calculation
  const whatIfProfile = useMemo<StudentProfile>(() => {
    if (!whatIfMode) return profile;
    // Build simulated extra AP courses (no score, status 'planned')
    const extraAPs: APCourse[] = Array.from({ length: whatIf.additionalAPs }, (_, i) => ({
      name: `Simulated AP ${i + 1}`,
      score: null,
      status: 'planned' as const,
    }));
    // Build simulated extra activities
    const extraActivities: Activity[] = Array.from({ length: whatIf.additionalActivities }, (_, i) => ({
      name: `Simulated Activity ${i + 1}`,
      category: 'Other',
      leadership: whatIf.additionalActivitiesLeadership,
      yearsActive: 1,
      hoursPerWeek: 3,
    }));
    return {
      ...profile,
      gpaUnweighted: whatIf.gpa,
      satScore: whatIf.satScore,
      actScore: whatIf.actScore,
      apCourses: [...profile.apCourses, ...extraAPs],
      activities: [...profile.activities, ...extraActivities],
    };
  }, [whatIfMode, whatIf, profile]);

  const whatIfResult = useMemo(() => {
    if (!whatIfMode || !school) return undefined;
    return calculateMatch(whatIfProfile, school, whatIf.appType, whatIf.testMode);
  }, [whatIfMode, whatIfProfile, school, whatIf.appType, whatIf.testMode]);

  // ─── Early returns ─────────────────────────────────────────────────────────
  if (!school) {
    return (
      <div style={{ minHeight: '100dvh', background: '#0A0F0E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#7A9E9B' }}>School not found</div>
      </div>
    );
  }

  if (!result) {
    return (
      <div style={{ minHeight: '100dvh', background: '#0A0F0E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#7A9E9B', textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>⏳</div>
          Calculating your match…
        </div>
      </div>
    );
  }

  const cat = CATEGORY_CONFIG[result.matchCategory];
  const color = cat.color;

  const appType = 'rd';
  const isLegacy = profile.legacySchools.includes(unitid);

  // Derive current display score (pending update shows immediately, committed is used for calc)
  const displaySat = whatIfMode ? pendingWhatIf.satScore : profile.satScore;
  const displayAct = whatIfMode ? pendingWhatIf.actScore : profile.actScore;

  return (
    <div style={{ minHeight: '100dvh', background: '#0A0F0E', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{
        padding: '20px 20px 0',
        paddingTop: 'max(20px, env(safe-area-inset-top))',
      }}>
        <Link href={`/schools/${unitid}`} style={{ textDecoration: 'none', color: '#7A9E9B', fontSize: 14, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
          ← Back to {school.short}
        </Link>

        {/* Page title */}
        {(() => {
          const currentBand = chanceBand(result.estimatedChance);
          const wiBand = whatIfResult ? chanceBand(whatIfResult.estimatedChance) : currentBand;
          const bandChanged = whatIfMode && whatIfResult && wiBand !== currentBand;
          // Direction: did the chance go UP a band?
          const overallDelta = (whatIfMode && whatIfResult) ? whatIfResult.estimatedChance - result.estimatedChance : 0;
          const hasOverallDelta = bandChanged;
          const deltaColor = overallDelta > 0 ? '#4ADE80' : '#F87171';
          return (
            <div style={{
              background: '#0F1817',
              border: `1px solid ${hasOverallDelta ? `${deltaColor}55` : `${color}30`}`,
              borderRadius: 16,
              padding: '12px 14px',
              marginBottom: 12,
              position: 'sticky',
              top: 'env(safe-area-inset-top, 0px)',
              zIndex: 30,
              backdropFilter: 'blur(10px)',
              boxShadow: hasOverallDelta ? `0 6px 18px ${deltaColor}25` : '0 4px 12px rgba(0,0,0,0.4)',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: `${color}18`,
                  border: `1px solid ${color}30`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 700,
                  color,
                  flexShrink: 0,
                }}>
                  {school.short.charAt(0)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h1 style={{ fontSize: 15, fontWeight: 700, color: '#F0FAFA', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Algorithm Breakdown</h1>
                  <div style={{ fontSize: 11, color: '#7A9E9B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{school.name}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {hasOverallDelta ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#7A9E9B', textDecoration: 'line-through', opacity: 0.7 }}>
                          {currentBand}
                        </span>
                        <span style={{ fontSize: 14, color: deltaColor }}>→</span>
                        <span style={{ fontSize: 24, fontWeight: 900, color: deltaColor, lineHeight: 1 }}>
                          {wiBand}
                        </span>
                      </div>
                      <div style={{ fontSize: 10, color: deltaColor, marginTop: 4, fontWeight: 600 }}>
                        {overallDelta > 0 ? 'chance improved' : 'chance dropped'}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 22, fontWeight: 800, color }}>
                        {currentBand}
                      </div>
                      <div style={{ fontSize: 10, color: '#7A9E9B' }}>est. chance</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Peer Benchmarks (CDS / IPEDS only — no fabricated stats) ── */}
        {computeBenchmarks(profile, school).length > 0 && (
          <div style={{
            background: '#0F1817',
            border: '1px solid #1E302E',
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 14,
          }}>
            <div style={{ fontSize: 11, color: '#7A9E9B', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              How you compare to admitted students
            </div>
            <BenchmarksDisplay profile={profile} school={school} />
            <div style={{ marginTop: 8, fontSize: 9, color: '#4A6560' }}>
              Source: IPEDS 2024 + school CDS
            </div>
          </div>
        )}

        {/* ── What If Mode Toggle ── */}
        <div style={{
          display: 'flex',
          background: '#111918',
          border: '1px solid #1E302E',
          borderRadius: 12,
          padding: 4,
          marginBottom: 14,
          gap: 4,
        }}>
          <button
            onClick={() => setWhatIfMode(false)}
            style={{
              flex: 1,
              minHeight: 44,
              background: !whatIfMode ? '#1E302E' : 'transparent',
              border: !whatIfMode ? '1px solid #2DD4BF30' : '1px solid transparent',
              borderRadius: 8,
              color: !whatIfMode ? '#F0FAFA' : '#7A9E9B',
              fontSize: 13,
              fontWeight: !whatIfMode ? 700 : 400,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            View Only
          </button>
          <button
            onClick={() => setWhatIfMode(true)}
            style={{
              flex: 1,
              minHeight: 44,
              background: whatIfMode ? '#2DD4BF18' : 'transparent',
              border: whatIfMode ? '1px solid #2DD4BF50' : '1px solid transparent',
              borderRadius: 8,
              color: whatIfMode ? '#2DD4BF' : '#7A9E9B',
              fontSize: 13,
              fontWeight: whatIfMode ? 700 : 400,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            ✦ What If
          </button>
        </div>

        {/* What If Mode hint banner */}
        {whatIfMode && (
          <div style={{
            background: '#2DD4BF0D',
            border: '1px solid #2DD4BF25',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 14,
            fontSize: 12,
            color: '#2DD4BF',
            lineHeight: 1.5,
          }}>
            Drag the sliders to simulate profile changes. Scores and formula update in real-time.
          </div>
        )}

        {/* Sections — kept inside the header wrapper so the sticky bar above
            has a containing block that extends the whole page. */}
        <GpaSection
          gpa={profile.gpaUnweighted}
          school={school}
          score={result.components.gpa}
          weight={school.gpa_weight}
          whatIfMode={whatIfMode}
          whatIfGpa={pendingWhatIf.gpa}
          whatIfScore={whatIfResult?.components.gpa}
          onWhatIfGpaChange={v => updateWhatIf({ gpa: v })}
        />

        <TestSection
          satScore={profile.satScore}
          actScore={profile.actScore}
          school={school}
          score={result.components.test}
          weight={school.test_weight}
          whatIfMode={whatIfMode}
          whatIfSat={displaySat}
          whatIfAct={displayAct}
          whatIfScore={whatIfResult?.components.test}
          testMode={whatIf.testMode}
          onWhatIfSatChange={v => updateWhatIf({ satScore: v })}
          onWhatIfActChange={v => updateWhatIf({ actScore: v })}
          onTestModeChange={m => updateWhatIf({ testMode: m })}
        />

        <RigorSection
          apCourses={profile.apCourses}
          ibProgram={profile.ibProgram}
          honorsCount={profile.honorsCount}
          school={school}
          score={result.components.rigor}
          weight={school.rigor_weight}
          whatIfMode={whatIfMode}
          additionalAPs={pendingWhatIf.additionalAPs}
          whatIfScore={whatIfResult?.components.rigor}
          onAdditionalAPsChange={v => updateWhatIf({ additionalAPs: v })}
        />

        <EcSection
          activities={profile.activities}
          awardsCount={profile.awardsCount}
          school={school}
          score={result.components.ec}
          weight={school.ec_weight}
          whatIfMode={whatIfMode}
          additionalActivities={pendingWhatIf.additionalActivities}
          additionalActivitiesLeadership={pendingWhatIf.additionalActivitiesLeadership}
          whatIfScore={whatIfResult?.components.ec}
          onAdditionalActivitiesChange={v => updateWhatIf({ additionalActivities: v })}
          onLeadershipToggle={() => updateWhatIf({ additionalActivitiesLeadership: !pendingWhatIf.additionalActivitiesLeadership })}
        />

        <BonusesSection
          appType={appType}
          isLegacy={isLegacy}
          isFirstGen={profile.firstGen}
          whatIfMode={whatIfMode}
          whatIfAppType={pendingWhatIf.appType}
          onAppTypeChange={v => updateWhatIf({ appType: v })}
          whatIfProfile={whatIfProfile}
          school={school}
          testMode={whatIf.testMode}
        />

        <FinalSection
          gpaScore={result.components.gpa}
          testScore={result.components.test}
          rigorScore={result.components.rigor}
          ecScore={result.components.ec}
          gpaWeight={school.gpa_weight}
          testWeight={school.test_weight}
          rigorWeight={school.rigor_weight}
          ecWeight={school.ec_weight}
          appType={appType}
          isLegacy={isLegacy}
          isFirstGen={profile.firstGen}
          matchScore={result.matchScore}
          estimatedChance={result.estimatedChance}
          category={result.matchCategory}
          color={color}
          school={school}
          whatIfMode={whatIfMode}
          whatIfResult={whatIfResult}
          whatIfAppType={pendingWhatIf.appType}
        />
      </div>

      {/* Slider styles injected once */}
      <style>{`
        input[type='range']::-webkit-slider-runnable-track {
          height: 6px;
          background: #1E302E;
          border-radius: 3px;
        }
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #2DD4BF;
          border: 2px solid #0A0F0E;
          box-shadow: 0 0 0 3px #2DD4BF30;
          margin-top: -9px;
          cursor: pointer;
        }
        input[type='range']::-moz-range-track {
          height: 6px;
          background: #1E302E;
          border-radius: 3px;
        }
        input[type='range']::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #2DD4BF;
          border: 2px solid #0A0F0E;
          box-shadow: 0 0 0 3px #2DD4BF30;
          cursor: pointer;
        }
      `}</style>

      <BottomNav />
    </div>
  );
}
