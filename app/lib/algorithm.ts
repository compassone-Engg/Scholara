import { School, StudentProfile, MatchResult } from './types';

/**
 * Maps a GPA to a percentile score (0-1) based on school's admitted GPA distribution.
 * Uses the school's gpa_bands to estimate where the student falls.
 * A higher percentile means the student's GPA is stronger relative to admitted students.
 */
function calcGpaPercentile(gpa: number, school: School): number {
  const bands = school.gpa_bands;
  // Bands ordered from lowest to highest GPA
  const bandThresholds = [
    { min: 0, max: 3.25, key: '<3.25' },
    { min: 3.25, max: 3.5, key: '3.25-3.49' },
    { min: 3.5, max: 3.75, key: '3.5-3.74' },
    { min: 3.75, max: 4.0, key: '3.75-4.0' },
    { min: 4.0, max: 5.0, key: '>4.0' },
  ];

  // Walk from lowest to highest band, accumulating the percentage below the student
  let cumulativeBelow = 0;
  for (const band of bandThresholds) {
    const pct = (bands[band.key] || 0) / 100;
    if (gpa >= band.max) {
      // Student is above this entire band
      cumulativeBelow += pct;
    } else if (gpa >= band.min && gpa < band.max) {
      // Student falls within this band — interpolate
      const bandWidth = band.max - band.min;
      const posInBand = bandWidth > 0 ? (gpa - band.min) / bandWidth : 0.5;
      cumulativeBelow += pct * posInBand;
      break;
    }
    // If gpa < band.min, we've passed the student's position — stop
  }

  // percentile = fraction of admits the student is above
  return Math.max(0, Math.min(1, cumulativeBelow));
}

/**
 * Maps a test score to a percentile (0-1) using school's 25/75 range.
 * Below 25th → 0.0-0.25 range
 * Between 25th-75th → 0.25-0.75 range (linear)
 * Above 75th → 0.75-1.0 range
 */
function calcTestPercentile(score: number, p25: number, p75: number): number {
  if (score <= p25) {
    // Map [0, p25] → [0, 0.25]
    const fraction = score / p25;
    return fraction * 0.25;
  } else if (score <= p75) {
    // Map [p25, p75] → [0.25, 0.75] linearly
    const fraction = (score - p25) / (p75 - p25);
    return 0.25 + fraction * 0.50;
  } else {
    // Map [p75, max] → [0.75, 1.0]
    // Assume max SAT=1600 or ACT=36
    const maxScore = p75 > 100 ? 1600 : 36;
    const fraction = Math.min(1, (score - p75) / (maxScore - p75));
    return 0.75 + fraction * 0.25;
  }
}

/**
 * Calculates a test score component (0-1) handling SAT/ACT and test-optional.
 *
 * testMode:
 *  - 'auto'     → if student has both SAT and ACT, use whichever yields the higher
 *                 percentile at this school (matches real admissions behavior — a
 *                 student would submit their stronger score).
 *  - 'sat_only' → use only SAT (ignore ACT even if present)
 *  - 'act_only' → use only ACT (ignore SAT even if present)
 */
function calcTestScore(
  profile: StudentProfile,
  school: School,
  testMode: 'auto' | 'sat_only' | 'act_only' = 'auto'
): number {
  const useSAT = testMode !== 'act_only' && !!profile.satScore && profile.satScore > 400;
  const useACT = testMode !== 'sat_only' && !!profile.actScore && profile.actScore > 1;

  if (!useSAT && !useACT) {
    // Test-optional (or user opted not to submit): no score = unknown, not excellent.
    // 0.5 baseline with a penalty at selective schools where most admits DO submit.
    const selectivityPenalty = school.selectivity === 'ultra_selective' ? 0.15 :
                               school.selectivity === 'highly_selective' ? 0.10 :
                               school.selectivity === 'selective' ? 0.05 :
                               0.0;
    return Math.max(0.1, 0.5 - selectivityPenalty);
  }

  const satPct = (useSAT && school.sat_25 && school.sat_75)
    ? calcTestPercentile(profile.satScore!, school.sat_25, school.sat_75)
    : null;
  const actPct = (useACT && school.act_25 && school.act_75)
    ? calcTestPercentile(profile.actScore!, school.act_25, school.act_75)
    : null;

  if (satPct !== null && actPct !== null) return Math.max(satPct, actPct); // submit the better one
  if (satPct !== null) return satPct;
  if (actPct !== null) return actPct;
  return 0.5; // school missing 25/75 bands → neutral
}

/**
 * Course rigor score (0-1) based on AP/IB/Honors courses.
 */
function calcRigorScore(profile: StudentProfile, school: School): number {
  const apCount = profile.apCourses.length;
  const apScores = profile.apCourses.filter(c => c.score && c.score >= 4);
  const ibBonus = profile.ibProgram ? 0.15 : 0;
  const honorsBonus = Math.min(0.1, profile.honorsCount * 0.02);

  // Normalize AP count based on school selectivity expectations
  const apTarget = school.selectivity === 'ultra_selective' ? 10 :
                   school.selectivity === 'highly_selective' ? 7 :
                   school.selectivity === 'selective' ? 5 : 3;

  const apScore = Math.min(1, apCount / apTarget) * 0.6;
  const apQualityScore = Math.min(0.25, (apScores.length / Math.max(1, apCount)) * 0.25);

  return Math.min(1, apScore + apQualityScore + ibBonus + honorsBonus);
}

/**
 * Extracurricular score (0-1) based on activities and school's EC importance.
 */
function calcEcScore(profile: StudentProfile, school: School): number {
  const activities = profile.activities;
  if (activities.length === 0) return 0.1;

  const ecFactorLabel = school.factor_labels.ec;

  // Schools that don't value ECs don't benefit from them
  if (ecFactorLabel === 'Not Considered' || ecFactorLabel === 'Not Used') {
    return 0.3; // Slight baseline
  }

  const leadershipCount = activities.filter(a => a.leadership).length;
  const researchCount = activities.filter(a => a.category.includes('Research')).length;
  const workCount = activities.filter(a => a.category.includes('Work')).length;
  const athleticsCount = activities.filter(a => a.category.includes('Athletics')).length;

  // Base score from activity count (depth > breadth - cap at 8)
  const baseScore = Math.min(1, activities.length / 8) * 0.4;

  // Leadership multiplier
  const leadershipBonus = Math.min(0.25, leadershipCount * 0.1);

  // Research/work bonus for competitive schools
  const prestigeBonus = Math.min(0.2, (researchCount * 0.1 + workCount * 0.05));

  // Varsity athletics bonus
  const athleticsBonus = athleticsCount > 0 ? 0.05 : 0;

  // Awards bonus
  const awardsBonus = Math.min(0.1, profile.awardsCount * 0.025);

  let ecScore = baseScore + leadershipBonus + prestigeBonus + athleticsBonus + awardsBonus;

  // Scale down if ECs are "Considered" (not Important)
  if (ecFactorLabel === 'Considered') {
    ecScore *= 0.7;
  }

  return Math.min(1, ecScore);
}

/**
 * Calculate application type bonus (0-0.15)
 */
function calcApplicationBonus(appType: 'ed' | 'ea' | 'rd', school: School): number {
  if (appType === 'ed') return 0.12; // ED boost is significant
  if (appType === 'ea') return 0.04;
  return 0;
}

/**
 * Convert match score (0-100) to category
 */
function scoreToCategory(score: number, acceptanceRate: number): MatchResult['matchCategory'] {
  // Adjust thresholds based on acceptance rate
  if (acceptanceRate < 0.08) {
    // Ultra-selective: much harder thresholds
    if (score >= 80) return 'reach';
    if (score >= 65) return 'reach';
    if (score >= 50) return 'far_reach';
    return 'far_reach';
  } else if (acceptanceRate < 0.25) {
    if (score >= 80) return 'match';
    if (score >= 65) return 'reach';
    if (score >= 50) return 'reach';
    return 'far_reach';
  } else if (acceptanceRate < 0.50) {
    if (score >= 80) return 'safety';
    if (score >= 65) return 'match';
    if (score >= 50) return 'reach';
    return 'far_reach';
  } else {
    if (score >= 70) return 'safety';
    if (score >= 55) return 'match';
    if (score >= 40) return 'reach';
    return 'far_reach';
  }
}

/**
 * Convert match score to estimated chance percentage.
 * Uses the school's actual acceptance rate as an anchor.
 */
function scoreToEstimatedChance(score: number, acceptanceRate: number | null): number {
  if (!acceptanceRate) return 0;

  // The match score represents relative positioning among applicants
  // A score of 50 = average applicant → admission chance ≈ acceptance rate
  // A score of 80 = strong applicant → higher chance
  // A score of 20 = weak applicant → lower chance

  const midScore = 50;
  const scoreDelta = (score - midScore) / midScore; // -1 to +1

  // Exponential scaling: strong candidates see bigger relative boost
  const multiplier = Math.exp(scoreDelta * 2.5);
  const rawChance = acceptanceRate * multiplier;

  // Cap at reasonable bounds
  const minChance = Math.max(0.002, acceptanceRate * 0.05);
  const maxChance = Math.min(0.95, acceptanceRate * 8);

  return Math.round(Math.min(maxChance, Math.max(minChance, rawChance)) * 100);
}

/**
 * Main algorithm: calculate match result for a student at a school.
 */
export function calculateMatch(
  profile: StudentProfile,
  school: School,
  appType: 'ed' | 'ea' | 'rd' = 'rd',
  testMode: 'auto' | 'sat_only' | 'act_only' = 'auto'
): MatchResult {
  // Component scores (0-1 each)
  const gpaScore = calcGpaPercentile(profile.gpaUnweighted, school);
  const testScore = calcTestScore(profile, school, testMode);
  const rigorScore = calcRigorScore(profile, school);
  const ecScore = calcEcScore(profile, school);

  // Weighted sum
  const remainingWeight = 1 - school.gpa_weight - school.test_weight - school.rigor_weight - school.ec_weight;

  const weightedScore =
    gpaScore * school.gpa_weight +
    testScore * school.test_weight +
    rigorScore * school.rigor_weight +
    ecScore * school.ec_weight +
    0.5 * Math.max(0, remainingWeight); // Neutral baseline for unweighted factors

  // Application bonus
  const appBonus = calcApplicationBonus(appType, school);

  // Legacy bonus
  const legacyBonus = profile.legacySchools.includes(school.unitid) ? 0.08 : 0;

  // First-gen bonus (some schools give slight preference)
  const firstGenBonus = profile.firstGen ? 0.02 : 0;

  // Combined score → 0-100
  const rawScore = (weightedScore + appBonus + legacyBonus + firstGenBonus);
  const matchScore = Math.round(Math.min(100, Math.max(0, rawScore * 100)));

  const acceptanceRate = school.acceptance_rate;
  const matchCategory = scoreToCategory(matchScore, acceptanceRate || 0.5);
  const estimatedChance = scoreToEstimatedChance(matchScore, acceptanceRate);

  return {
    schoolUnitid: school.unitid,
    matchScore,
    matchCategory,
    estimatedChance,
    components: {
      gpa: Math.round(gpaScore * 100),
      test: Math.round(testScore * 100),
      rigor: Math.round(rigorScore * 100),
      ec: Math.round(ecScore * 100),
    },
  };
}

/**
 * Calculate match results for all schools.
 */
export function calculateAllMatches(
  profile: StudentProfile,
  schools: School[],
  defaultAppType: 'ed' | 'ea' | 'rd' = 'rd'
): MatchResult[] {
  return schools.map(school => {
    // Per-school appType derived from profile: ED bonus only at the picked ED school,
    // EA bonus only at the picked EA school, otherwise the default (usually 'rd').
    const appType: 'ed' | 'ea' | 'rd' =
      profile.earlyDecisionSchool === school.unitid ? 'ed' :
      profile.earlyActionSchool === school.unitid ? 'ea' :
      defaultAppType;
    return calculateMatch(profile, school, appType);
  });
}

/**
 * Calculate overall readiness score (0-100) — a single number for the dashboard.
 */
export function calcReadinessScore(profile: StudentProfile, schools: School[]): number {
  if (schools.length === 0) return 0;

  // Use top 10 realistic target schools
  const results = calculateAllMatches(profile, schools);
  const topResults = results
    .filter(r => r.matchCategory === 'match' || r.matchCategory === 'safety')
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 10);

  if (topResults.length === 0) {
    // Student is reaching for everything — readiness should reflect that
    const avg = results.reduce((sum, r) => sum + r.matchScore, 0) / results.length;
    return Math.round(avg * 0.7); // Penalize if no matches/safeties exist
  }

  // Blend: 60% from top matches/safeties, 40% from overall average
  const topAvg = topResults.reduce((sum, r) => sum + r.matchScore, 0) / topResults.length;
  const overallAvg = results.reduce((sum, r) => sum + r.matchScore, 0) / results.length;
  return Math.round(topAvg * 0.6 + overallAvg * 0.4);
}

/**
 * Generate "what if" tip: which single change would most improve chances.
 */
export function generateTopTip(
  profile: StudentProfile,
  schools: School[]
): string {
  // Find the school they're closest to moving from reach → match
  const results = calculateAllMatches(profile, schools);
  const nearMisses = results
    .filter(r => r.matchCategory === 'reach' && r.matchScore >= 55)
    .sort((a, b) => b.matchScore - a.matchScore);

  if (nearMisses.length === 0) {
    return 'Keep up your GPA — it\'s your strongest predictor of admission.';
  }

  const topNearMiss = nearMisses[0];
  const school = schools.find(s => s.unitid === topNearMiss.schoolUnitid);
  if (!school) return 'Focus on raising your GPA and test scores.';

  // Find weakest component
  const comps = topNearMiss.components;
  const weakest = Object.entries(comps).sort((a, b) => a[1] - b[1])[0];

  switch (weakest[0]) {
    case 'gpa':
      return `Raising your GPA by 0.2 points could move ${school.name} from Reach to Match.`;
    case 'test':
      return `Improving your SAT by 50-80 points could significantly boost your ${school.name} chances.`;
    case 'rigor':
      return `Adding one more AP class would boost your ${school.name} readiness by ~8 points.`;
    case 'ec':
      return `A leadership role in an existing club could strengthen your ${school.name} application.`;
    default:
      return `Your ${school.name} application is close — a strong essay could push you over.`;
  }
}
