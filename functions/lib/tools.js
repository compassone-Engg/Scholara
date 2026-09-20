// Tool definitions + handlers for the chatbot. Tools are the ONLY path
// through which the LLM is allowed to surface facts about the student or
// schools. Provider-neutral schemas; converted per-provider in providers/*.js

import { calculateMatch, calculateAllMatches } from './algorithm.js';
import { computeBenchmarks } from './benchmarks.js';

// ─── Schemas ────────────────────────────────────────────────────────
// Each tool: name, description, parameters (JSON-Schema-like).

export const TOOL_SCHEMAS = [
  {
    name: 'get_my_profile',
    description: "Returns the current student's academic profile (GPA, test scores, AP courses, activities, etc.) as captured in onboarding. Use this whenever the user asks about their own situation.",
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_my_applying_list',
    description: "Returns the list of schools the student has marked as 'applying to'. Use this when the user asks about 'my list' or 'the schools I'm applying to'.",
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_my_favorites',
    description: "Returns the list of schools the student has favorited. Use this when the user references favorites.",
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_match_results',
    description: "Returns the student's match score, category, and estimated admission chance for one or all schools. Always call this before giving strategy advice. If no unitid is provided, returns all 60 schools.",
    parameters: {
      type: 'object',
      properties: {
        unitid: { type: 'string', description: 'IPEDS unitid of one school. Omit to get results for all schools.' },
        category: { type: 'string', enum: ['safety', 'match', 'reach', 'far_reach'], description: 'Optional filter to a single category.' },
      },
      required: [],
    },
  },
  {
    name: 'get_school_details',
    description: 'Returns full details for a single school: name, location, acceptance rate, SAT/ACT ranges, GPA bands, factor weights, deadlines, and policies.',
    parameters: {
      type: 'object',
      properties: { unitid: { type: 'string', description: 'IPEDS unitid' } },
      required: ['unitid'],
    },
  },
  {
    name: 'get_school_policy',
    description: "Returns a specific policy field for a school. Available fields: superscores_sat (boolean — does the school superscore SAT), superscores_act (boolean — does the school superscore ACT), recommendations_required (number), demonstrated_interest ('not_considered'|'considered'|'important'), application_platform (e.g. 'Common Application' or 'UC Application'), application_fee (number, USD), fee_waiver_available (boolean), supplemental_essays_required (boolean), test_policy ('required'|'optional'|'blind'|'free_choice'|'flexible'), interview_offered (false | 'optional' | 'required'), cycle_year (string). Pass 'all' for the full policy block.",
    parameters: {
      type: 'object',
      properties: {
        unitid: { type: 'string' },
        field: { type: 'string', description: 'The policy field name. Pass "all" to get the full policy block.' },
      },
      required: ['unitid', 'field'],
    },
  },
  {
    name: 'get_deadline',
    description: 'Returns ED, EA, REA, or RD deadline for a school. Always call this when the user asks about a deadline; never guess from memory.',
    parameters: {
      type: 'object',
      properties: {
        unitid: { type: 'string' },
        app_type: { type: 'string', enum: ['ed', 'ea', 'rd', 'all'], description: 'Which deadline to retrieve. Pass "all" for every available deadline at the school.' },
      },
      required: ['unitid', 'app_type'],
    },
  },
  {
    name: 'simulate_what_if',
    description: "Recompute the student's match score at one or all schools as if their profile had specific changes. Use this to answer 'what if I raised my GPA to 3.9' or 'what if I added 2 APs'. The change is hypothetical — does not modify the actual profile.",
    parameters: {
      type: 'object',
      properties: {
        changes: {
          type: 'object',
          description: 'Profile fields to override. Supported: gpaUnweighted (number), satScore (number or null), actScore (number or null), apCourseCount (number — sets length only), honorsCount (number), activitiesCount (number), legacySchoolUnitid (string), firstGen (boolean), ibProgram (boolean), appType ("ed" | "ea" | "rd").',
        },
        unitid: { type: 'string', description: 'Single school. Omit to recompute for all 60.' },
      },
      required: ['changes'],
    },
  },
  {
    name: 'get_checklist',
    description: 'Returns the application checklist for a specific school: tasks (with category, due date, estimated time), platform (Common App / UC App / etc.), and platform-level deadlines.',
    parameters: {
      type: 'object',
      properties: { unitid: { type: 'string' } },
      required: ['unitid'],
    },
  },
  {
    name: 'search_schools',
    description: "Find schools matching criteria. Use to answer 'safeties I'm not considering' or 'mid-tier private schools in the Northeast'.",
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['national', 'california'] },
        state: { type: 'string', description: 'Two-letter state code, e.g. "MA"' },
        selectivity: { type: 'string', enum: ['ultra_selective', 'highly_selective', 'selective', 'less_selective'] },
        max_acceptance_rate: { type: 'number', description: '0-1, e.g. 0.25 for under 25%' },
        min_acceptance_rate: { type: 'number' },
        application_platform: { type: 'string', description: 'e.g. "Common Application", "UC Application"' },
        max_results: { type: 'number', description: 'Cap. Default 10.' },
      },
      required: [],
    },
  },
  {
    name: 'get_benchmarks',
    description: "Returns outcome benchmarks comparing the student's profile to admitted students at a school. Use this whenever the user asks 'how do I compare to X', 'am I being realistic about X', 'what does it take to get into X', or for any college-fit reality check. Returns up to 3 lines: GPA (% of admits scoring higher), SAT or ACT placement (top quartile / above median / middle 50% / below 25th), and the Fall 2024 admit rate. ALL lines are sourced from CDS gpa_bands and IPEDS 2024 — no fabricated stats. Cite these numbers verbatim when grounding any reality-check claim.",
    parameters: {
      type: 'object',
      properties: {
        unitid: { type: 'string', description: 'IPEDS unitid of the school to benchmark against.' },
      },
      required: ['unitid'],
    },
  },
  {
    name: 'get_methodology_section',
    description: 'Return a plain-text excerpt of a section of the published methodology (the same /methodology page on the site). Use this when the user asks how the algorithm works.',
    parameters: {
      type: 'object',
      properties: {
        section: { type: 'string', enum: ['algorithm_plain_english', 'gpa_percentile', 'test_percentile', 'rigor', 'ec', 'weighted_sum', 'bonuses', 'category_thresholds', 'chance_calculation', 'limitations'] },
      },
      required: ['section'],
    },
  },
];

// ─── Methodology snippets (mirrors methodology.html for quoting) ─────

const METHODOLOGY_TEXT = {
  algorithm_plain_english: "Scholara asks five questions per school: (1) How does the student's GPA compare to admitted GPAs at this school? (2) How does their test score compare to this school's middle 50%? (3) How rigorous is their courseload relative to this school's selectivity tier? (4) How strong are their activities, scaled by how much this school weighs ECs? (5) What's their application type and hooks? Each component (GPA, test, rigor, EC) gets a 0-1 score, weighted using the school's own factor importance from the Common Data Set, then bonuses for ED/EA/legacy/first-gen are added. The result is a 0-100 match score, mapped to a category (Safety/Match/Reach/Far Reach) and an estimated chance % anchored to the school's actual acceptance rate.",
  gpa_percentile: "Each school has a 5-band GPA distribution from CDS (e.g. UCLA: 40% above 4.0, 30% in 3.75-4.0, 20% in 3.5-3.74, 7% in 3.25-3.49, 3% below 3.25). The student's GPA is placed in its band; we sum the percentages of all bands below them, plus a linear interpolation within their band. Result is the percentage of admits the student would be above.",
  test_percentile: "Three-segment piecewise linear: scores below the 25th percentile map to 0-0.25; scores in the 25-75 middle range map to 0.25-0.75; scores above the 75th map to 0.75-1.0. If the student submits both SAT and ACT, the two percentiles are averaged. If they submit neither (test-optional), score is 0.5 minus a selectivity penalty (15 points at ultra-selective, 10 at highly, 5 at selective).",
  rigor: "AP target by selectivity tier: 10 (ultra), 7 (highly), 5 (selective), 3 (less). Rigor = (AP count vs target)*0.6 + (AP-quality bonus from 4+ scores)*0.25 + IB bonus (+0.15) + honors bonus (capped at 0.10). Sum capped at 1.",
  ec: "Activity count contribution: min(1, count/8)*0.4. Plus leadership bonus (capped 0.25), prestige bonus from research/work activities (capped 0.20), varsity athletics bonus (0.05), awards bonus (capped 0.10). If school marks ECs as 'Considered' (not Important), final score multiplied by 0.7. If 'Not Considered', flat 0.3.",
  weighted_sum: "Per-school weights from CDS: gpa_weight, test_weight, rigor_weight, ec_weight (e.g. UCLA: 0.35, 0.25, 0.20, 0.15). Any unaccounted-for weight is filled with a neutral 0.5 baseline so we don't penalize for things we can't measure (essays, recommendations).",
  bonuses: "ED: +0.12. EA: +0.04. Legacy: +0.08 (if student listed school as legacy). First-gen: +0.02. Bonuses added to the weighted sum on the 0-1 scale; total is then multiplied by 100 and clamped to [0, 100].",
  category_thresholds: "Thresholds shift with school's actual acceptance rate. Under 8% acceptance: 65+ is Reach, below 50 is Far Reach. 8-25%: 80+ Match, 50+ Reach. 25-50%: 80+ Safety, 65+ Match, 50+ Reach. 50%+: 70+ Safety, 55+ Match, 40+ Reach.",
  chance_calculation: "scoreDelta = (matchScore - 50) / 50, range -1 to +1. Multiplier = exp(scoreDelta * 2.5). raw = acceptance_rate * multiplier. Capped: minChance = max(0.2%, ar*5%); maxChance = min(95%, ar*8). The 8x cap exists so a perfect-on-paper student at Harvard sees ~32% (8 * ~4%), not 95%.",
  limitations: "Algorithm is rules-based, not learned from outcomes. Major-specific selectivity not modeled. Demonstrated interest captured in the school's CDS factor labels but not in student profile inputs. Recommendations and essays treated as 0.5 neutral baseline. ED bonus is fixed at +0.12 per school (real ED uplift varies). Profile is self-reported. Race not used in scoring (post-SFFA v Harvard 2023).",
};

// ─── Lookup helper ─────────────────────────────────────────────────
// Tools that take a unitid should be lenient: fall back to short/name
// match if the LLM hallucinates the numeric id (it does, sometimes).

function findSchool(ctx, identifier) {
  if (!identifier) return null;
  const id = String(identifier).trim();
  if (!id) return null;
  const lower = id.toLowerCase();
  // 1. Exact unitid
  let s = ctx.schools.find(x => String(x.unitid) === id);
  if (s) return s;
  // 2. Exact short (case-insensitive)
  s = ctx.schools.find(x => (x.short || '').toLowerCase() === lower);
  if (s) return s;
  // 3. Exact name (case-insensitive)
  s = ctx.schools.find(x => (x.name || '').toLowerCase() === lower);
  if (s) return s;
  // 4. Substring on name or short
  s = ctx.schools.find(x =>
    (x.name || '').toLowerCase().includes(lower) ||
    (x.short || '').toLowerCase().includes(lower)
  );
  return s || null;
}

// ─── Handlers ───────────────────────────────────────────────────────
// `ctx` is { profile, applying, favorites, schools, checklists }
// schools and checklists are loaded server-side per request.

export async function executeTool(name, args, ctx) {
  switch (name) {
    case 'get_my_profile': {
      const p = ctx.profile || {};
      // Return summary fields only — this is what the AI needs to reason
      return {
        // What to call the student. Prefer nickname; fall back to first name.
        // Use this in EVERY reply when addressing the student.
        nameToUse: ((p.nickname && p.nickname.trim()) || ((p.name || '').trim().split(/\s+/)[0]) || null),
        nickname: p.nickname || null,
        name: p.name || null,
        intendedMajor: p.intendedMajor || null,
        gpaUnweighted: p.gpaUnweighted,
        gpaWeighted: p.gpaWeighted,
        satScore: p.satScore,
        actScore: p.actScore,
        apCourseCount: (p.apCourses || []).length,
        apCoursesWithGoodScores: (p.apCourses || []).filter(c => c.score && c.score >= 4).length,
        ibProgram: !!p.ibProgram,
        honorsCount: p.honorsCount || 0,
        activitiesCount: (p.activities || []).length,
        leadershipCount: (p.activities || []).filter(a => a.leadership).length,
        awardsCount: p.awardsCount || 0,
        firstGen: !!p.firstGen,
        legacySchoolCount: (p.legacySchools || []).length,
        grade: p.grade,
        state: p.state,
      };
    }

    case 'get_my_applying_list': {
      const list = ctx.applying || [];
      return list.map(unitid => {
        const school = ctx.schools.find(s => String(s.unitid) === String(unitid));
        return school ? { unitid, name: school.name, short: school.short, acceptance_rate: school.acceptance_rate } : { unitid, missing: true };
      });
    }

    case 'get_my_favorites': {
      const list = ctx.favorites || [];
      return list.map(unitid => {
        const school = ctx.schools.find(s => String(s.unitid) === String(unitid));
        return school ? { unitid, name: school.name, short: school.short } : { unitid, missing: true };
      });
    }

    case 'get_match_results': {
      const results = calculateAllMatches(ctx.profile || {}, ctx.schools, 'rd');
      let filtered = results;
      if (args.unitid) {
        const school = findSchool(ctx, args.unitid);
        if (!school) return { error: 'school_not_found', identifier: args.unitid };
        filtered = filtered.filter(r => String(r.schoolUnitid) === String(school.unitid));
      }
      if (args.category) filtered = filtered.filter(r => r.matchCategory === args.category);
      // Add school name for readability
      return filtered.map(r => {
        const school = ctx.schools.find(s => String(s.unitid) === String(r.schoolUnitid));
        return {
          ...r,
          name: school?.name,
          short: school?.short,
          acceptance_rate: school?.acceptance_rate,
        };
      });
    }

    case 'get_school_details': {
      const school = findSchool(ctx, args.unitid);
      if (!school) return { error: 'school_not_found', identifier: args.unitid };
      // Return everything except heavy bands metadata
      return {
        unitid: school.unitid,
        name: school.name,
        short: school.short,
        type: school.type,
        city: school.city,
        state: school.state,
        website: school.website,
        admissions_url: school.admissions_url,
        acceptance_rate: school.acceptance_rate,
        applicants: school.applicants,
        admitted: school.admitted,
        enrolled: school.enrolled,
        sat_25: school.sat_25, sat_50: school.sat_50, sat_75: school.sat_75,
        act_25: school.act_25, act_50: school.act_50, act_75: school.act_75,
        selectivity: school.selectivity,
        gpa_weight: school.gpa_weight, test_weight: school.test_weight,
        rigor_weight: school.rigor_weight, ec_weight: school.ec_weight,
        factor_labels: school.factor_labels,
        gpa_bands: school.gpa_bands,
        ed_deadline: school.ed_deadline, ea_deadline: school.ea_deadline, rd_deadline: school.rd_deadline,
        policy: school.policy,
      };
    }

    case 'get_school_policy': {
      const school = findSchool(ctx, args.unitid);
      if (!school) return { error: 'school_not_found', identifier: args.unitid };
      const policy = school.policy || {};
      if (args.field === 'all') return policy;
      if (!(args.field in policy)) return { error: 'field_not_found', unitid: args.unitid, field: args.field, available: Object.keys(policy) };
      return { unitid: args.unitid, name: school.name, field: args.field, value: policy[args.field] };
    }

    case 'get_deadline': {
      const school = findSchool(ctx, args.unitid);
      if (!school) return { error: 'school_not_found', identifier: args.unitid };
      const all = { ed: school.ed_deadline, ea: school.ea_deadline, rd: school.rd_deadline };
      if (args.app_type === 'all') return { unitid: args.unitid, name: school.name, deadlines: all };
      if (args.app_type in all) return { unitid: args.unitid, name: school.name, app_type: args.app_type, deadline: all[args.app_type] };
      return { error: 'invalid_app_type', allowed: ['ed', 'ea', 'rd', 'all'] };
    }

    case 'simulate_what_if': {
      const c = args.changes || {};
      const newProfile = { ...(ctx.profile || {}) };
      if ('gpaUnweighted' in c) newProfile.gpaUnweighted = Number(c.gpaUnweighted);
      if ('satScore' in c) newProfile.satScore = c.satScore == null ? null : Number(c.satScore);
      if ('actScore' in c) newProfile.actScore = c.actScore == null ? null : Number(c.actScore);
      if ('apCourseCount' in c) {
        const n = Math.max(0, Math.floor(Number(c.apCourseCount)));
        newProfile.apCourses = Array.from({ length: n }, (_, i) => ({ name: `simulated_ap_${i+1}`, score: 4 }));
      }
      if ('honorsCount' in c) newProfile.honorsCount = Number(c.honorsCount);
      if ('activitiesCount' in c) {
        const n = Math.max(0, Math.floor(Number(c.activitiesCount)));
        newProfile.activities = Array.from({ length: n }, (_, i) => ({ category: 'General', leadership: false }));
      }
      if ('legacySchoolUnitid' in c) {
        const cur = new Set(newProfile.legacySchools || []);
        cur.add(String(c.legacySchoolUnitid));
        newProfile.legacySchools = Array.from(cur);
      }
      if ('firstGen' in c) newProfile.firstGen = !!c.firstGen;
      if ('ibProgram' in c) newProfile.ibProgram = !!c.ibProgram;
      const appType = c.appType || 'rd';
      const before = calculateAllMatches(ctx.profile || {}, ctx.schools, appType);
      const after = calculateAllMatches(newProfile, ctx.schools, appType);
      const compare = (results) => {
        let arr = results;
        if (args.unitid) {
          const sc = findSchool(ctx, args.unitid);
          if (sc) arr = arr.filter(r => String(r.schoolUnitid) === String(sc.unitid));
          else arr = [];
        }
        return arr;
      };
      const beforeArr = compare(before);
      const afterArr = compare(after);
      // Build delta summary
      const deltas = beforeArr.map(b => {
        const a = afterArr.find(x => x.schoolUnitid === b.schoolUnitid);
        const school = ctx.schools.find(s => String(s.unitid) === String(b.schoolUnitid));
        return {
          unitid: b.schoolUnitid,
          name: school?.name,
          before: { score: b.matchScore, category: b.matchCategory, chance: b.estimatedChance },
          after:  { score: a?.matchScore, category: a?.matchCategory, chance: a?.estimatedChance },
          delta_score: (a?.matchScore || 0) - b.matchScore,
          delta_chance: (a?.estimatedChance || 0) - b.estimatedChance,
        };
      });
      // Sort by absolute score change desc
      deltas.sort((x, y) => Math.abs(y.delta_score) - Math.abs(x.delta_score));
      return { changes: c, results: deltas.slice(0, args.unitid ? 1 : 20) };
    }

    case 'get_checklist': {
      const school = findSchool(ctx, args.unitid);
      if (!school) return { error: 'school_not_found', identifier: args.unitid };
      const key = (school.policy && school.policy.checklist_key) || String(args.unitid);
      const cl = ctx.checklists[key] || ctx.checklists[String(args.unitid)] || ctx.checklists['common_app_template'];
      return {
        unitid: args.unitid,
        name: school.name,
        platform: cl.platform,
        deadlines: cl.deadlines,
        tasks: cl.tasks,
      };
    }

    case 'search_schools': {
      let candidates = ctx.schools;
      if (args.type) candidates = candidates.filter(s => s.type === args.type);
      if (args.state) candidates = candidates.filter(s => s.state === args.state);
      if (args.selectivity) candidates = candidates.filter(s => s.selectivity === args.selectivity);
      if (typeof args.max_acceptance_rate === 'number') candidates = candidates.filter(s => (s.acceptance_rate || 0) <= args.max_acceptance_rate);
      if (typeof args.min_acceptance_rate === 'number') candidates = candidates.filter(s => (s.acceptance_rate || 0) >= args.min_acceptance_rate);
      if (args.application_platform) candidates = candidates.filter(s => s.policy && s.policy.application_platform === args.application_platform);
      const max = Math.min(20, Math.max(1, Number(args.max_results) || 10));
      return candidates.slice(0, max).map(s => ({
        unitid: s.unitid, name: s.name, short: s.short, type: s.type, state: s.state,
        acceptance_rate: s.acceptance_rate, selectivity: s.selectivity,
        sat_25: s.sat_25, sat_75: s.sat_75,
        platform: s.policy?.application_platform,
      }));
    }

    case 'get_benchmarks': {
      const s = findSchool(ctx, args.unitid);
      if (!s) return { error: 'school_not_found', unitid: args.unitid };
      const lines = computeBenchmarks(ctx.profile || {}, s);
      return {
        unitid: s.unitid,
        school_name: s.name,
        benchmarks: lines,
        note: 'All lines sourced from IPEDS 2024 + school Common Data Set. No fabricated stats.',
      };
    }

    case 'get_methodology_section': {
      const text = METHODOLOGY_TEXT[args.section];
      if (!text) return { error: 'unknown_section', allowed: Object.keys(METHODOLOGY_TEXT) };
      return { section: args.section, text };
    }

    default:
      return { error: 'unknown_tool', name };
  }
}
