// Server-side port of app/lib/algorithm.ts. Same formulas, same constants.
// Used by chat tools (simulate_what_if, get_match_results) so the AI never
// has to "guess" a match score — it always calls back into the canonical
// algorithm.

function calcGpaPercentile(gpa, school) {
  const bands = school.gpa_bands || {};
  const ranges = [
    { min: 0,    max: 3.25, key: '<3.25' },
    { min: 3.25, max: 3.5,  key: '3.25-3.49' },
    { min: 3.5,  max: 3.75, key: '3.5-3.74' },
    { min: 3.75, max: 4.0,  key: '3.75-4.0' },
    { min: 4.0,  max: 5.0,  key: '>4.0' },
  ];
  let cum = 0;
  for (const b of ranges) {
    const pct = (bands[b.key] || 0) / 100;
    if (gpa >= b.max) cum += pct;
    else if (gpa >= b.min) {
      const w = b.max - b.min;
      const pos = w > 0 ? (gpa - b.min) / w : 0.5;
      cum += pct * pos;
      break;
    }
  }
  return Math.max(0, Math.min(1, cum));
}

function calcTestPercentile(score, p25, p75) {
  if (score <= p25) return (score / p25) * 0.25;
  if (score <= p75) return 0.25 + ((score - p25) / (p75 - p25)) * 0.5;
  const max = p75 > 100 ? 1600 : 36;
  return 0.75 + Math.min(1, (score - p75) / (max - p75)) * 0.25;
}

function calcTestScore(profile, school) {
  const hasSAT = profile.satScore && profile.satScore > 400;
  const hasACT = profile.actScore && profile.actScore > 1;
  if (!hasSAT && !hasACT) {
    const penalty = school.selectivity === 'ultra_selective' ? 0.15
                  : school.selectivity === 'highly_selective' ? 0.10
                  : school.selectivity === 'selective' ? 0.05 : 0;
    return Math.max(0.1, 0.5 - penalty);
  }
  let total = 0, n = 0;
  if (hasSAT && school.sat_25 && school.sat_75) {
    total += calcTestPercentile(profile.satScore, school.sat_25, school.sat_75); n++;
  }
  if (hasACT && school.act_25 && school.act_75) {
    total += calcTestPercentile(profile.actScore, school.act_25, school.act_75); n++;
  }
  return n > 0 ? total / n : 0.5;
}

function calcRigorScore(profile, school) {
  const apCourses = profile.apCourses || [];
  const apCount = apCourses.length;
  const apHigh = apCourses.filter(c => c.score && c.score >= 4).length;
  const ibBonus = profile.ibProgram ? 0.15 : 0;
  const honorsBonus = Math.min(0.1, (profile.honorsCount || 0) * 0.02);
  const target = school.selectivity === 'ultra_selective' ? 10
              : school.selectivity === 'highly_selective' ? 7
              : school.selectivity === 'selective' ? 5 : 3;
  const apScore = Math.min(1, apCount / target) * 0.6;
  const apQ = Math.min(0.25, (apHigh / Math.max(1, apCount)) * 0.25);
  return Math.min(1, apScore + apQ + ibBonus + honorsBonus);
}

function calcEcScore(profile, school) {
  const acts = profile.activities || [];
  if (acts.length === 0) return 0.1;
  const lbl = school.factor_labels?.ec || '';
  if (lbl === 'Not Considered' || lbl === 'Not Used') return 0.3;
  const lead = acts.filter(a => a.leadership).length;
  const research = acts.filter(a => (a.category || '').includes('Research')).length;
  const work = acts.filter(a => (a.category || '').includes('Work')).length;
  const ath = acts.filter(a => (a.category || '').includes('Athletics')).length;
  const base = Math.min(1, acts.length / 8) * 0.4;
  const leadBonus = Math.min(0.25, lead * 0.1);
  const prestige = Math.min(0.2, research * 0.1 + work * 0.05);
  const athBonus = ath > 0 ? 0.05 : 0;
  const awards = Math.min(0.1, (profile.awardsCount || 0) * 0.025);
  let s = base + leadBonus + prestige + athBonus + awards;
  if (lbl === 'Considered') s *= 0.7;
  return Math.min(1, s);
}

function appBonus(appType) {
  return appType === 'ed' ? 0.12 : appType === 'ea' ? 0.04 : 0;
}

function scoreToCategory(score, ar) {
  const r = ar || 0.5;
  if (r < 0.08) {
    if (score >= 65) return 'reach';
    return 'far_reach';
  }
  if (r < 0.25) {
    if (score >= 80) return 'match';
    if (score >= 50) return 'reach';
    return 'far_reach';
  }
  if (r < 0.5) {
    if (score >= 80) return 'safety';
    if (score >= 65) return 'match';
    if (score >= 50) return 'reach';
    return 'far_reach';
  }
  if (score >= 70) return 'safety';
  if (score >= 55) return 'match';
  if (score >= 40) return 'reach';
  return 'far_reach';
}

function scoreToChance(score, ar) {
  if (!ar) return 0;
  const delta = (score - 50) / 50;
  const mult = Math.exp(delta * 2.5);
  const raw = ar * mult;
  const lo = Math.max(0.002, ar * 0.05);
  const hi = Math.min(0.95, ar * 8);
  return Math.round(Math.min(hi, Math.max(lo, raw)) * 100);
}

export function calculateMatch(profile, school, appType = 'rd') {
  const gpa = calcGpaPercentile(profile.gpaUnweighted || 0, school);
  const test = calcTestScore(profile, school);
  const rigor = calcRigorScore(profile, school);
  const ec = calcEcScore(profile, school);
  const remaining = 1 - (school.gpa_weight || 0) - (school.test_weight || 0)
                      - (school.rigor_weight || 0) - (school.ec_weight || 0);
  const weighted =
    gpa * (school.gpa_weight || 0)
    + test * (school.test_weight || 0)
    + rigor * (school.rigor_weight || 0)
    + ec * (school.ec_weight || 0)
    + 0.5 * Math.max(0, remaining);
  const ab = appBonus(appType);
  const lb = (profile.legacySchools || []).includes(school.unitid) ? 0.08 : 0;
  const fg = profile.firstGen ? 0.02 : 0;
  const raw = weighted + ab + lb + fg;
  const matchScore = Math.round(Math.min(100, Math.max(0, raw * 100)));
  const ar = school.acceptance_rate;
  return {
    schoolUnitid: school.unitid,
    matchScore,
    matchCategory: scoreToCategory(matchScore, ar || 0.5),
    estimatedChance: scoreToChance(matchScore, ar),
    components: {
      gpa: Math.round(gpa * 100),
      test: Math.round(test * 100),
      rigor: Math.round(rigor * 100),
      ec: Math.round(ec * 100),
    },
  };
}

export function calculateAllMatches(profile, schools, appType = 'rd') {
  return schools.map(s => calculateMatch(profile, s, appType));
}
