// 4-year roadmap data + storage hook.
// Items have stable IDs so completion state can be persisted and migrated
// without breakage. State uses the same cloud-shaped schema pattern as
// milestones: userId-scoped, UUID event IDs, ISO timestamps.

export type RoadmapCategory = 'testing' | 'application' | 'academic' | 'extracurricular' | 'financial';
export type RoadmapGrade = 9 | 10 | 11 | 12;

export interface RoadmapItem {
  id: string;                    // stable identifier — DO NOT change after launch
  grade: RoadmapGrade;
  month: number;                 // 1-12 (Jan-Dec)
  title: string;
  description: string;
  category: RoadmapCategory;
  isDeadline?: boolean;
}

export const ROADMAP_CATEGORY_COLORS: Record<RoadmapCategory, string> = {
  testing: '#A78BFA',
  application: '#2DD4BF',
  academic: '#4ADE80',
  extracurricular: '#FACC15',
  financial: '#FB923C',
};

export const ROADMAP_CATEGORY_ICONS: Record<RoadmapCategory, string> = {
  testing: '📝',
  application: '📋',
  academic: '📚',
  extracurricular: '🏆',
  financial: '💰',
};

export const GRADE_LABELS: Record<RoadmapGrade, string> = {
  9: 'Freshman',
  10: 'Sophomore',
  11: 'Junior',
  12: 'Senior',
};

// Stable IDs follow `g{grade}_m{month}_{slug}` — never change after launch.
export const ROADMAP_DATA: RoadmapItem[] = [
  // ── Grade 9 ──────────────────────────────────────────────────────────────
  { id: 'g9_m9_track_gpa',           grade: 9, month: 9,  title: 'Start tracking your GPA',            description: 'Every grade matters from day one. Set up a system to track your grades.',                              category: 'academic' },
  { id: 'g9_m9_explore_ecs',         grade: 9, month: 9,  title: 'Explore extracurriculars',          description: 'Try different activities — sports, clubs, arts. Find what you love.',                                  category: 'extracurricular' },
  { id: 'g9_m10_challenging_courses',grade: 9, month: 10, title: 'Take challenging courses',          description: 'Sign up for honors or accelerated courses if available.',                                              category: 'academic' },
  { id: 'g9_m1_reading_habit',       grade: 9, month: 1,  title: 'Build a reading habit',             description: 'Read widely. It builds vocabulary for SAT/ACT and writing skills.',                                  category: 'testing' },
  { id: 'g9_m3_research_colleges',   grade: 9, month: 3,  title: 'Research colleges casually',         description: 'Start exploring what types of schools interest you.',                                                 category: 'application' },

  // ── Grade 10 ─────────────────────────────────────────────────────────────
  { id: 'g10_m10_psat10',            grade: 10, month: 10, title: 'Take the PSAT 10',                  description: 'Get familiar with the format before the high-stakes PSAT/NMSQT.',                                    category: 'testing' },
  { id: 'g10_m10_add_aps',           grade: 10, month: 10, title: 'Add AP classes',                    description: 'If ready, take AP World History, AP Human Geography, or your first AP.',                              category: 'academic' },
  { id: 'g10_m11_deepen_ecs',        grade: 10, month: 11, title: 'Deepen extracurricular commitments', description: 'Depth over breadth. Stick with activities you started in 9th grade.',                                  category: 'extracurricular' },
  { id: 'g10_m1_community_service',  grade: 10, month: 1,  title: 'Start community service',           description: 'Find a cause you care about. Sustained service is more impactful than one-off events.',              category: 'extracurricular' },
  { id: 'g10_m2_visit_local',        grade: 10, month: 2,  title: 'Visit local college campuses',      description: 'Get a feel for different campus environments without high stakes.',                                  category: 'application' },
  { id: 'g10_m6_summer_programs',    grade: 10, month: 6,  title: 'Consider summer programs',          description: 'Academic summer programs, research opportunities, or pre-college programs.',                          category: 'academic' },

  // ── Grade 11 ─────────────────────────────────────────────────────────────
  { id: 'g11_m10_psat_nmsqt',        grade: 11, month: 10, title: 'Take the PSAT/NMSQT',               description: 'This is the National Merit qualifier. Aim for your best score.',                                     category: 'testing', isDeadline: true },
  { id: 'g11_m11_load_aps',          grade: 11, month: 11, title: 'Load up on AP classes',             description: 'Junior year AP performance is most visible to admissions. Take 3-5 APs if possible.',                category: 'academic' },
  { id: 'g11_m11_seek_leadership',   grade: 11, month: 11, title: 'Seek leadership positions',         description: 'Run for club president, team captain, or committee chair.',                                          category: 'extracurricular' },
  { id: 'g11_m3_first_sat_act',      grade: 11, month: 3,  title: 'Take SAT or ACT (first attempt)',   description: 'Spring of junior year is ideal for your first full attempt.',                                        category: 'testing', isDeadline: true },
  { id: 'g11_m3_college_list',       grade: 11, month: 3,  title: 'Start college list research',       description: 'Begin building your list of 8-12 schools: 2-3 safety, 4-5 match, 2-3 reach.',                          category: 'application' },
  { id: 'g11_m4_college_fairs',      grade: 11, month: 4,  title: 'Attend college fairs',              description: 'Meet admissions reps and ask targeted questions.',                                                    category: 'application' },
  { id: 'g11_m4_request_recs',       grade: 11, month: 4,  title: 'Request letters of recommendation', description: 'Ask 2-3 teachers who know you well. Junior year teachers are ideal.',                                category: 'application', isDeadline: true },
  { id: 'g11_m5_retake_test',        grade: 11, month: 5,  title: 'Retake SAT/ACT if needed',          description: 'If you want a higher score, plan your retake strategy.',                                              category: 'testing' },
  { id: 'g11_m6_visit_targets',      grade: 11, month: 6,  title: 'Visit target schools',              description: 'Plan campus visits for spring break or early summer.',                                                category: 'application' },
  { id: 'g11_m8_common_app_opens',   grade: 11, month: 8,  title: 'Common App opens — create account', description: 'August 1: Common App opens. Set up your account and start exploring.',                                category: 'application', isDeadline: true },
  { id: 'g11_m8_essay_brainstorm',   grade: 11, month: 8,  title: 'Begin essay brainstorming',         description: 'Spend the summer exploring essay topics. Write multiple drafts.',                                    category: 'application' },

  // ── Grade 12 ─────────────────────────────────────────────────────────────
  { id: 'g12_m8_start_apps',         grade: 12, month: 8,  title: 'Start applications in earnest',     description: 'Common App is live. Begin filling out activity lists, demographics, etc.',                            category: 'application' },
  { id: 'g12_m9_finalize_list',      grade: 12, month: 9,  title: 'Finalize your college list',        description: 'Narrow to your final list. Make sure you have a balanced range.',                                    category: 'application' },
  { id: 'g12_m9_polish_essays',      grade: 12, month: 9,  title: 'Polish your essays',                description: 'Work with a counselor, teacher, or trusted adult on your main essay.',                              category: 'application' },
  { id: 'g12_m10_ed_ea_approaching', grade: 12, month: 10, title: 'ED/EA deadlines approaching',       description: 'Most Early Decision and Early Action deadlines are November 1-15.',                                  category: 'application', isDeadline: true },
  { id: 'g12_m11_submit_ed_ea',      grade: 12, month: 11, title: 'Submit ED/EA applications',         description: 'Early Decision: Nov 1. Early Action: Nov 1-15. Confirm deadlines for each school.',                  category: 'application', isDeadline: true },
  { id: 'g12_m12_ed_decisions',      grade: 12, month: 12, title: 'ED decisions arrive',               description: 'If admitted ED, you must withdraw other applications. Start Regular Decision apps.',                category: 'application' },
  { id: 'g12_m12_submit_rd',         grade: 12, month: 12, title: 'Submit Regular Decision applications', description: 'Most RD deadlines are January 1-15. Submit before the deadline.',                                   category: 'application', isDeadline: true },
  { id: 'g12_m1_rd_deadlines',       grade: 12, month: 1,  title: 'RD application deadlines',          description: "January 1-15: Most Regular Decision deadlines. Don't miss them.",                                     category: 'application', isDeadline: true },
  { id: 'g12_m2_fafsa',              grade: 12, month: 2,  title: 'File FAFSA and CSS Profile',        description: 'Financial aid applications due. File as early as possible.',                                          category: 'financial', isDeadline: true },
  { id: 'g12_m3_rd_decisions',       grade: 12, month: 3,  title: 'RD decisions start arriving',       description: 'March-April: Regular Decision decisions arrive. Evaluate financial aid packages.',                  category: 'application' },
  { id: 'g12_m5_decision_day',       grade: 12, month: 5,  title: 'National Decision Day — May 1',     description: 'Commit to your school! Send deposit, withdraw from other schools.',                                  category: 'application', isDeadline: true },
];

/** Items for a given grade. */
export function itemsForGrade(grade: RoadmapGrade): RoadmapItem[] {
  return ROADMAP_DATA.filter(i => i.grade === grade);
}

/** Lock semantics: a grade above the student's current grade is locked. */
export function isGradeLocked(itemGrade: RoadmapGrade, currentGrade: 9 | 10 | 11 | 12 | null): boolean {
  if (currentGrade === null) return false; // before grade is set, nothing is locked but nothing is checkable either
  return itemGrade > currentGrade;
}
