// Server-side mirror of app/lib/benchmarks.ts.
// Returns the same outcome-only peer benchmarks used in the app.
// NO fabricated stats. Everything traces to a real field in schools.json.

export function computeBenchmarks(profile, school) {
  const lines = [];

  // GPA bands (admitted student GPA distribution from CDS)
  if (school.gpa_bands && profile.gpaUnweighted) {
    const g = profile.gpaUnweighted;
    const parseRange = key => {
      if (key.startsWith('>')) return { min: parseFloat(key.slice(1)), max: 5 };
      if (key.startsWith('<')) return { min: 0, max: parseFloat(key.slice(1)) };
      const [a, b] = key.split('-').map(parseFloat);
      return { min: a, max: b };
    };
    let aboveYou = 0;
    for (const [key, pct] of Object.entries(school.gpa_bands)) {
      const r = parseRange(key);
      if (r.min >= g) aboveYou += pct;
    }
    if (aboveYou > 0 && aboveYou < 100) {
      lines.push({ label: 'GPA', value: `${aboveYou}% of admits scored higher`, note: `you: ${g.toFixed(2)}`, source: 'CDS gpa_bands' });
    } else if (aboveYou === 0) {
      lines.push({ label: 'GPA', value: 'Your GPA is at or above the typical admit', note: `you: ${g.toFixed(2)}`, source: 'CDS gpa_bands' });
    }
  }

  // SAT placement
  if (profile.satScore && profile.satScore > 400 && school.sat_25 && school.sat_75) {
    const s = profile.satScore;
    const mid = school.sat_50 ?? Math.round((school.sat_25 + school.sat_75) / 2);
    let placement;
    if (s >= school.sat_75) placement = `top quartile (>=${school.sat_75})`;
    else if (s >= mid) placement = `above median (~${mid})`;
    else if (s >= school.sat_25) placement = `middle 50% (${school.sat_25}-${school.sat_75})`;
    else placement = `below 25th percentile (${school.sat_25})`;
    lines.push({ label: 'SAT', value: placement, note: `you: ${s}`, source: 'IPEDS 2024' });
  } else if (profile.actScore && profile.actScore > 1 && school.act_25 && school.act_75) {
    const a = profile.actScore;
    const mid = school.act_50 ?? Math.round((school.act_25 + school.act_75) / 2);
    let placement;
    if (a >= school.act_75) placement = `top quartile (>=${school.act_75})`;
    else if (a >= mid) placement = `above median (~${mid})`;
    else if (a >= school.act_25) placement = `middle 50% (${school.act_25}-${school.act_75})`;
    else placement = `below 25th percentile (${school.act_25})`;
    lines.push({ label: 'ACT', value: placement, note: `you: ${a}`, source: 'IPEDS 2024' });
  }

  // Admit rate
  if (school.acceptance_rate !== null && school.acceptance_rate !== undefined) {
    const pct = (school.acceptance_rate * 100).toFixed(1);
    lines.push({ label: 'Admit rate', value: `${pct}% admitted (Fall 2024)`, source: 'IPEDS 2024' });
  }

  return lines;
}
