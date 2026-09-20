// Peer benchmarks — outcome-only comparisons against admitted students.
// EVERYTHING here must trace back to a real field in schools.json (CDS or IPEDS).
// NO fabricated behavioral stats ("70% start SAT prep before August" → not allowed).

import { School, StudentProfile } from './types';

export interface BenchmarkLine {
  label: string;      // short uppercase tag, e.g. "GPA"
  value: string;      // the meaningful comparison sentence
  note?: string;      // optional "you: 3.70" rhs
  source: string;     // provenance — short, e.g. "CDS gpa_bands"
}

/**
 * Compute outcome benchmarks for a student vs. a school.
 * Returns 0–3 lines depending on what data the school has and what the student has filled in.
 */
export function computeBenchmarks(profile: StudentProfile, school: School): BenchmarkLine[] {
  const lines: BenchmarkLine[] = [];

  // ── GPA band comparison ───────────────────────────────────────────────────
  // gpa_bands shape (admitted student GPA distribution from CDS):
  //   { ">4.0": 60, "3.75-4.0": 25, "3.5-3.74": 10, "3.25-3.49": 3, "<3.25": 2 }
  if (school.gpa_bands && profile.gpaUnweighted) {
    const g = profile.gpaUnweighted;
    const parseRange = (key: string): { min: number; max: number } => {
      if (key.startsWith('>')) return { min: parseFloat(key.slice(1)), max: 5 };
      if (key.startsWith('<')) return { min: 0, max: parseFloat(key.slice(1)) };
      const [a, b] = key.split('-').map(parseFloat);
      return { min: a, max: b };
    };
    // % of admits whose entire band sits above the student's GPA
    let aboveYou = 0;
    for (const [key, pct] of Object.entries(school.gpa_bands)) {
      const r = parseRange(key);
      if (r.min >= g) aboveYou += pct;
    }
    if (aboveYou > 0 && aboveYou < 100) {
      lines.push({
        label: 'GPA',
        value: `${aboveYou}% of admits scored higher`,
        note: `you: ${g.toFixed(2)}`,
        source: 'CDS gpa_bands',
      });
    } else if (aboveYou === 0) {
      lines.push({
        label: 'GPA',
        value: 'Your GPA is at or above the typical admit',
        note: `you: ${g.toFixed(2)}`,
        source: 'CDS gpa_bands',
      });
    }
  }

  // ── SAT / ACT placement against the school's 25/50/75 range ──────────────
  if (profile.satScore && profile.satScore > 400 && school.sat_25 && school.sat_75) {
    const s = profile.satScore;
    const mid = school.sat_50 ?? Math.round((school.sat_25 + school.sat_75) / 2);
    let placement: string;
    if (s >= school.sat_75) placement = `top quartile (≥${school.sat_75})`;
    else if (s >= mid) placement = `above median (~${mid})`;
    else if (s >= school.sat_25) placement = `middle 50% (${school.sat_25}–${school.sat_75})`;
    else placement = `below 25th percentile (${school.sat_25})`;
    lines.push({
      label: 'SAT',
      value: placement,
      note: `you: ${s}`,
      source: 'IPEDS 2024',
    });
  } else if (profile.actScore && profile.actScore > 1 && school.act_25 && school.act_75) {
    const a = profile.actScore;
    const mid = school.act_50 ?? Math.round((school.act_25 + school.act_75) / 2);
    let placement: string;
    if (a >= school.act_75) placement = `top quartile (≥${school.act_75})`;
    else if (a >= mid) placement = `above median (~${mid})`;
    else if (a >= school.act_25) placement = `middle 50% (${school.act_25}–${school.act_75})`;
    else placement = `below 25th percentile (${school.act_25})`;
    lines.push({
      label: 'ACT',
      value: placement,
      note: `you: ${a}`,
      source: 'IPEDS 2024',
    });
  }

  // ── Admit rate (Fall 2024, federally reported) ────────────────────────────
  if (school.acceptance_rate !== null && school.acceptance_rate !== undefined) {
    const pct = (school.acceptance_rate * 100).toFixed(1);
    lines.push({
      label: 'Admit rate',
      value: `${pct}% admitted (Fall 2024)`,
      source: 'IPEDS 2024',
    });
  }

  return lines;
}

/**
 * Plain-text rendering of benchmarks for use in the AI counselor tool output
 * or anywhere we need a string instead of JSX.
 */
export function benchmarksToText(profile: StudentProfile, school: School): string {
  const lines = computeBenchmarks(profile, school);
  if (lines.length === 0) return 'No benchmark data available for this school + profile combination.';
  return lines.map(l => `- ${l.label}: ${l.value}${l.note ? ` (${l.note})` : ''}`).join('\n');
}
