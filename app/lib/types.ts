export interface School {
  unitid: string;
  name: string;
  short: string;
  type: 'national' | 'california';
  city: string;
  state: string;
  website: string;
  admissions_url: string;
  acceptance_rate: number | null;
  applicants: number | null;
  admitted: number | null;
  enrolled: number | null;
  sat_25: number | null;
  sat_50: number | null;
  sat_75: number | null;
  act_25: number | null;
  act_50: number | null;
  act_75: number | null;
  selectivity: 'ultra_selective' | 'highly_selective' | 'selective' | 'less_selective';
  gpa_weight: number;
  test_weight: number;
  rigor_weight: number;
  ec_weight: number;
  factor_labels: {
    gpa: string;
    tests: string;
    rigor: string;
    ec: string;
  };
  gpa_bands: Record<string, number>;
  ed_deadline: string | null;
  ea_deadline: string | null;
  rd_deadline: string | null;
}

export interface APCourse {
  name: string;
  score: number | null; // 1-5, null if not taken yet
  status: 'completed' | 'in_progress' | 'planned';
}

export interface Activity {
  category: string;
  name: string;
  leadership: boolean;
  yearsActive: number;
  hoursPerWeek: number;
}

export type ClassRank = 'top_10' | 'top_25' | 'top_50' | 'lower_half' | 'unknown';
export type ApplicationType = 'ed' | 'ea' | 'rd';
// Which test score to use when both SAT and ACT are present.
// 'auto' = use whichever yields the higher percentile at this school (matches real admissions behavior).
export type TestSubmissionMode = 'auto' | 'sat_only' | 'act_only';

export interface StudentProfile {
  name: string;
  nickname: string; // what the student wants to be called — used in all addressed copy
  grade: 9 | 10 | 11 | 12 | null;
  state: string;
  highSchool: string;
  gender: string;
  ethnicity: string;
  firstGen: boolean;
  legacySchools: string[]; // unitids
  intendedMajor: string; // canonical key from MAJOR_OPTIONS, or '' if unset
  earlyDecisionSchool: string | null; // unitid of the school you plan to ED to (or null). ED is binding and single-school.
  earlyActionSchool: string | null;   // unitid of the school you plan to EA to (or null). Single-school for now.
  // Academics
  gpaUnweighted: number;
  gpaWeighted: number;
  classRank: ClassRank;
  satScore: number | null;
  actScore: number | null;
  psatScore: number | null;
  // Courses
  apCourses: APCourse[];
  ibProgram: boolean;
  honorsCount: number;
  // Activities
  activities: Activity[];
  awardsCount: number;
  totalHoursPerWeek: number;
}

export interface MatchResult {
  schoolUnitid: string;
  matchScore: number; // 0-100
  matchCategory: 'safety' | 'match' | 'reach' | 'far_reach';
  estimatedChance: number; // 0-100 %
  components: {
    gpa: number;
    test: number;
    rigor: number;
    ec: number;
  };
}

export type OnboardingStep = 1 | 2 | 3 | 4;

export const AP_COURSES = [
  'AP Art History', 'AP Biology', 'AP Calculus AB', 'AP Calculus BC',
  'AP Chemistry', 'AP Chinese Language', 'AP Computer Science A',
  'AP Computer Science Principles', 'AP English Language',
  'AP English Literature', 'AP Environmental Science',
  'AP European History', 'AP French Language', 'AP German Language',
  'AP Government (Comparative)', 'AP Government (US)', 'AP Human Geography',
  'AP Italian Language', 'AP Japanese Language', 'AP Latin',
  'AP Macroeconomics', 'AP Microeconomics', 'AP Music Theory',
  'AP Physics 1', 'AP Physics 2', 'AP Physics C: E&M', 'AP Physics C: Mech',
  'AP Psychology', 'AP Research', 'AP Seminar', 'AP Spanish Language',
  'AP Spanish Literature', 'AP Statistics', 'AP Studio Art',
  'AP US History', 'AP World History',
];

export const ACTIVITY_CATEGORIES = [
  'Athletics (Varsity)',
  'Athletics (Club/Intramural)',
  'Student Government / Leadership',
  'Community Service / Volunteering',
  'Work Experience',
  'Arts / Music / Theater',
  'Academic Clubs (Debate, Science Olympiad, etc.)',
  'Research / Internships',
  'Religious / Cultural Organizations',
  'Other',
];

export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

// Intended-major options shown in onboarding + profile.
// Values are canonical lowercase keys; labels are display text.
export const MAJOR_OPTIONS: { value: string; label: string }[] = [
  { value: 'undecided', label: 'Undecided' },
  { value: 'computer_science', label: 'Computer Science' },
  { value: 'engineering_general', label: 'Engineering (general / undecided)' },
  { value: 'mechanical_engineering', label: 'Mechanical Engineering' },
  { value: 'electrical_engineering', label: 'Electrical Engineering' },
  { value: 'civil_engineering', label: 'Civil Engineering' },
  { value: 'chemical_engineering', label: 'Chemical Engineering' },
  { value: 'biomedical_engineering', label: 'Biomedical Engineering' },
  { value: 'biology', label: 'Biology / Life Sciences' },
  { value: 'pre_med', label: 'Pre-Med / Pre-Health' },
  { value: 'chemistry', label: 'Chemistry' },
  { value: 'physics', label: 'Physics' },
  { value: 'mathematics', label: 'Mathematics' },
  { value: 'data_science', label: 'Data Science / Statistics' },
  { value: 'business', label: 'Business / Management' },
  { value: 'economics', label: 'Economics' },
  { value: 'finance', label: 'Finance' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'psychology', label: 'Psychology' },
  { value: 'political_science', label: 'Political Science' },
  { value: 'international_relations', label: 'International Relations' },
  { value: 'sociology', label: 'Sociology' },
  { value: 'history', label: 'History' },
  { value: 'english', label: 'English / Literature' },
  { value: 'communications', label: 'Communications / Journalism' },
  { value: 'education', label: 'Education / Teaching' },
  { value: 'nursing', label: 'Nursing' },
  { value: 'public_health', label: 'Public Health' },
  { value: 'environmental_science', label: 'Environmental Science' },
  { value: 'architecture', label: 'Architecture' },
  { value: 'art_design', label: 'Art / Design' },
  { value: 'music', label: 'Music' },
  { value: 'theater_film', label: 'Theater / Film' },
  { value: 'other', label: 'Other (not listed)' },
];

export const DEFAULT_PROFILE: StudentProfile = {
  name: '',
  nickname: '',
  grade: null,
  state: '',
  highSchool: '',
  gender: '',
  intendedMajor: '',
  ethnicity: '',
  firstGen: false,
  legacySchools: [],
  earlyDecisionSchool: null,
  earlyActionSchool: null,
  gpaUnweighted: 3.5,
  gpaWeighted: 4.0,
  classRank: 'unknown',
  satScore: null,
  actScore: null,
  psatScore: null,
  apCourses: [],
  ibProgram: false,
  honorsCount: 2,
  activities: [],
  awardsCount: 0,
  totalHoursPerWeek: 10,
};
