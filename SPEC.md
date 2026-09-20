# Scholara MVP — Product Specification

## Overview
Scholara is a mobile-first AI-powered college admissions strategy engine. It predicts a student's admission chances at 60 target schools using real admissions data and lets them simulate how changes (better grades, adding APs, joining clubs) affect their odds in real-time.

**Tagline:** "Big goals. Small steps. Real success."

## Target User
High school students (grades 9-12) and their parents. Initial focus: California and students targeting top national universities.

## Core Principle
Replace the $5K-$10K private counselor with a data-driven, always-available app at $15/month.

---

## Architecture

### Platform
- **Mobile-first** web app (PWA) — no desktop version assumed
- Responsive touch-optimized UI
- Installable as home screen app (PWA manifest)
- Works offline for cached data

### Tech Stack
- **Frontend:** Next.js 15 + React 19 + Tailwind CSS v4
- **UI:** Mobile-first component library (touch targets ≥44px, swipe gestures)
- **Backend:** Next.js API routes
- **Database:** Supabase (auth + Postgres)
- **School Data:** Pre-loaded from IPEDS + CDS datasets
- **Hosting:** Cloudflare Pages (metaba.ai subdomain)

---

## Module 1: Prediction Engine

### Student Profile Input (4-step onboarding)

**Step 1 — Basic Info**
- Full name
- Current grade level (9/10/11/12)
- High school name (optional — for future flywheel)
- State
- Gender (optional)
- Race/ethnicity (optional — affects some school contexts)
- First generation college student? (yes/no)
- Legacy at any target school? (yes/no)

**Step 2 — Academics**
- Current unweighted GPA (slider: 1.0 - 4.0, step 0.1)
- Current weighted GPA (slider: 1.0 - 5.0, step 0.1)
- Class rank (top 10%, 25%, 50%, lower half, unknown)
- SAT score (slider: 400 - 1600, step 10) — or "not taken yet"
- ACT score (slider: 1 - 36, step 1) — or "not taken yet"
- PSAT score (optional)

**Step 3 — Courses**
- AP classes taken/planned (multi-select from AP course list)
- AP scores received (per class: 1-5 or "not taken yet")
- IB program? (yes/no)
- Honors courses count

**Step 4 — Activities & Context**
- Extracurriculars (multi-select categories):
  - Athletics (varsity/club/intramural)
  - Student government / leadership
  - Community service / volunteering
  - Work experience / employment
  - Arts / music / theater
  - Academic clubs (debate, science olympiad, etc.)
  - Research / internships
  - Religious / cultural organizations
  - Other
- Leadership positions held (count)
- Awards / honors (count + notable ones)
- Hours per week on activities (slider)

### The Algorithm

For each of the 60 schools, calculate a **Match Score (0-100)**:

```
match_score = (
    gpa_percentile_score × gpa_weight +
    test_score_percentile × test_weight +
    course_rigor_score × rigor_weight +
    extracurricular_score × ec_weight +
    application_type_bonus +
    demographic_adjustments
) × 100
```

**Component calculations:**

1. **GPA Percentile Score (0-1):**
   - Map student GPA to the school's admitted GPA distribution (from CDS data)
   - 4.0+ in a school where median is 3.9 = high percentile
   - 3.2 in a school where median is 3.9 = low percentile
   - Use normal distribution fit on CDS GPA bands

2. **Test Score Percentile (0-1):**
   - Map student SAT/ACT to school's 25th-75th percentile range (from IPEDS)
   - Below 25th = 0.0-0.25 range
   - Between 25th-75th = 0.25-0.75 range (linear interpolation)
   - Above 75th = 0.75-1.0 range
   - If test-optional and no score: use GPA-only model with adjusted weights

3. **Course Rigor Score (0-1):**
   - Count of AP/IB/Honors courses relative to availability
   - Bonus for AP scores of 4-5
   - Weighted by relevance to intended major (future feature)

4. **Extracurricular Score (0-1):**
   - Based on CDS factor weights for the specific school
   - "Very Important" EC school: strong ECs = big boost
   - "Not Considered" EC school: ECs matter less
   - Leadership multiplier
   - Work experience factor (from CDS weight)

5. **Weights per school (from CDS Section C7):**
   - Each school has its own weight vector
   - Harvard weights ECs as "Very Important" → ec_weight = 0.25
   - UC Berkeley doesn't consider ECs → ec_weight = 0.05
   - Weights normalize to sum = 1.0

6. **Application Type Bonus:**
   - Early Decision: +5-15% based on school's ED acceptance rate vs RD
   - Early Action: +2-5%
   - Regular Decision: baseline

7. **Translation to admission chance:**
   - Match score maps to probability using historical acceptance rate as anchor
   - Score 80+ at a 10% acceptance school ≠ 80% chance
   - Instead: "Strong Match" / "Match" / "Reach" / "Far Reach" categories
   - Plus an estimated percentage derived from the school's overall rate adjusted by the student's relative positioning

### The Sliders (Real-Time Simulation)
- Every input field is interactive
- Changing GPA slider instantly recalculates all 60 schools
- Adding an AP class shows "+X pts readiness" in real-time
- Adding an extracurricular shows impact (varies by school)
- Debounced calculation (100ms) for smooth feel
- Before/after comparison: "If you raise your GPA from 3.2 to 3.5, your Berkeley chance goes from Reach to Match"

---

## Module 2: Timeline Engine

### 4-Year College Prep Timeline

Pre-built timeline customized by:
- Student's current grade level
- Target school types (UC system, Ivy League, state schools, etc.)
- Application strategy (ED/EA/RD)

### Timeline Items (by grade)

**Freshman Year (Grade 9)**
- Start tracking GPA — every grade matters
- Explore extracurricular interests
- Take challenging courses available
- Build reading habit (helps SAT/ACT later)
- Research colleges casually

**Sophomore Year (Grade 10)**
- Take PSAT (practice + National Merit qualifier for junior year)
- Add AP classes if ready
- Deepen extracurricular commitments (depth > breadth)
- Start community service
- Visit local college campuses
- Consider summer programs

**Junior Year (Grade 11)**
- Take PSAT/NMSQT (October — National Merit qualifier)
- Take SAT/ACT (spring — first attempt)
- Load up on AP classes
- Leadership positions in activities
- Start college list research
- Attend college fairs
- Visit target schools (spring break / summer)
- Start Common App account (opens Aug 1)
- Begin essay brainstorming (summer before senior year)
- Request letters of recommendation (spring of junior year)

**Senior Year (Grade 12)**
- August: Common App opens — start applications
- September: Finalize college list, continue essays
- October: Early Decision/Early Action deadlines approaching
- November 1-15: Most ED/EA deadlines
- December: ED decisions arrive, submit Regular Decision apps
- January 1-15: Most RD deadlines
- February: Submit FAFSA and CSS Profile (if not done earlier)
- March-April: RD decisions arrive
- May 1: National Decision Day — commit to your school

### School-Specific Deadlines
- Pull from school data: ED deadline, EA deadline, RD deadline
- Financial aid deadlines
- Scholarship deadlines (future feature)
- Populate dynamically based on student's target list

### Notifications
- Push notifications for upcoming deadlines (future — PWA notifications)
- "Your Berkeley application is due in 30 days"
- "Have you requested your letters of recommendation?"

---

## Module 3: Dashboard

### Home Screen (Mobile)
```
┌─────────────────────────────┐
│  Scholara                 ⚙ │
│                             │
│  Hi Alex 👋                 │
│                             │
│  ┌─────────────────────┐    │
│  │   Readiness Score    │    │
│  │       ◉ 64          │    │
│  │   Good — Keep going  │    │
│  └─────────────────────┘    │
│                             │
│  📅 Next Up                 │
│  ├─ PSAT: 12 days away      │
│  ├─ UC App opens: 4 months  │
│  └─ SAT Prep: start now     │
│                             │
│  🎯 Top Matches             │
│  ├─ UC San Diego    78% ●●●●│
│  ├─ UC Davis        72% ●●● │
│  ├─ UCLA            34% ●●  │
│  ├─ UC Berkeley     18% ●   │
│  └─ Stanford         6% ○   │
│                             │
│  💡 Recommended Action      │
│  "Adding AP Bio would boost │
│   your Berkeley readiness   │
│   by 8 points"              │
│                             │
│  [Schools] [Timeline] [Me]  │
└─────────────────────────────┘
```

### Schools Tab
- List of 60 schools with match score
- Tap to expand: detailed breakdown
- Filter: Reach / Match / Safety
- Filter: California / National
- Sort: Match % / Name / Acceptance Rate

### Timeline Tab
- Scrollable 4-year timeline
- Current position highlighted
- Upcoming items with countdown
- Completed items checked off
- Tap to expand for details

### Profile Tab ("Me")
- All student inputs with sliders
- "Simulate" mode: try changes without saving
- "What If" scenarios

---

## 60 Target Schools

### Top 30 National
1. Harvard, 2. Stanford, 3. MIT, 4. Yale, 5. Princeton,
6. Columbia, 7. UChicago, 8. Duke, 9. Northwestern, 10. Johns Hopkins,
11. Caltech, 12. Brown, 13. Vanderbilt, 14. Rice, 15. Dartmouth,
16. Cornell, 17. UPenn, 18. Georgetown, 19. Emory, 20. Carnegie Mellon,
21. USC, 22. NYU, 23. Notre Dame, 24. UVA, 25. UMich,
26. Georgia Tech, 27. UNC Chapel Hill, 28. Boston College, 29. Tufts, 30. Wake Forest

### 30 California Schools
1. UC Berkeley, 2. UCLA, 3. UC San Diego, 4. UC Davis, 5. UC Irvine,
6. UC Santa Barbara, 7. UC Santa Cruz, 8. UC Riverside, 9. UC Merced,
10. Cal Poly SLO, 11. San Diego State, 12. CSUF, 13. CSULA, 14. CSULB,
15. San Jose State, 16. SF State, 17. Sacramento State,
18. Pomona College, 19. Claremont McKenna, 20. Harvey Mudd,
21. Pitzer College, 22. Scripps College, 23. Occidental College,
24. Loyola Marymount, 25. Chapman University, 26. University of San Diego,
27. Santa Clara University, 28. University of the Pacific,
29. Cal Poly Pomona, 30. Pepperdine

---

## Data Pipeline

### Initial Load (from downloaded data)
1. IPEDS ADM2023 → acceptance rates, SAT/ACT percentiles for 60 schools
2. IPEDS HD2023 → school names, locations, URLs
3. IPEDS DRVADM2022 → pre-calculated rates
4. GradGPT CDS → admissions factor weights, GPA distributions
5. Opportunity Insights → income mobility context

### Database Schema (Supabase/Postgres)

```sql
-- Schools
CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unitid TEXT UNIQUE NOT NULL, -- IPEDS ID
  name TEXT NOT NULL,
  state TEXT,
  city TEXT,
  type TEXT, -- 'national' or 'california'
  acceptance_rate DECIMAL,
  sat_25 INTEGER,
  sat_50 INTEGER,
  sat_75 INTEGER,
  act_25 INTEGER,
  act_50 INTEGER,
  act_75 INTEGER,
  gpa_bands JSONB, -- {">4.0": 35, "3.75-4.0": 30, ...}
  factor_weights JSONB, -- {"gpa": "Very Important", "ec": "Important", ...}
  ed_rate DECIMAL,
  ea_rate DECIMAL,
  rd_rate DECIMAL,
  ed_deadline DATE,
  ea_deadline DATE,
  rd_deadline DATE,
  financial_aid_deadline DATE,
  website TEXT,
  admissions_url TEXT,
  updated_at TIMESTAMP DEFAULT now()
);

-- Student profiles
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT,
  grade INTEGER, -- 9, 10, 11, 12
  state TEXT,
  high_school TEXT,
  gpa_unweighted DECIMAL,
  gpa_weighted DECIMAL,
  class_rank TEXT,
  sat_score INTEGER,
  act_score INTEGER,
  psat_score INTEGER,
  first_gen BOOLEAN DEFAULT false,
  legacy_schools UUID[], -- school IDs
  gender TEXT,
  ethnicity TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Student courses
CREATE TABLE student_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  course_name TEXT NOT NULL,
  course_type TEXT, -- 'ap', 'ib', 'honors', 'regular'
  grade_received TEXT, -- 'A', 'B', etc. or null if planned
  ap_score INTEGER, -- 1-5 or null
  year_taken TEXT, -- 'freshman', 'sophomore', etc.
  status TEXT DEFAULT 'completed' -- 'completed', 'in_progress', 'planned'
);

-- Student activities
CREATE TABLE student_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  category TEXT NOT NULL,
  name TEXT,
  leadership BOOLEAN DEFAULT false,
  years_active INTEGER DEFAULT 1,
  hours_per_week DECIMAL,
  description TEXT
);

-- Match results (cached calculations)
CREATE TABLE match_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  school_id UUID REFERENCES schools(id),
  match_score INTEGER, -- 0-100
  match_category TEXT, -- 'safety', 'match', 'reach', 'far_reach'
  estimated_chance DECIMAL,
  gpa_component DECIMAL,
  test_component DECIMAL,
  rigor_component DECIMAL,
  ec_component DECIMAL,
  calculated_at TIMESTAMP DEFAULT now(),
  UNIQUE(student_id, school_id)
);

-- Timeline items
CREATE TABLE timeline_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade INTEGER NOT NULL,
  month INTEGER, -- 1-12
  title TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'testing', 'application', 'academic', 'extracurricular', 'financial'
  is_deadline BOOLEAN DEFAULT false,
  school_specific BOOLEAN DEFAULT false,
  school_id UUID REFERENCES schools(id),
  sort_order INTEGER
);
```

---

## Build Order

### Phase 1: Data + Algorithm (Day 1)
- Populate `schools` table with 60 schools from IPEDS + CDS data
- Implement match score algorithm
- Test with sample student profiles

### Phase 2: Onboarding + Profile (Day 1-2)
- 4-step mobile onboarding flow
- Student profile storage
- Supabase auth (email + Google)

### Phase 3: Dashboard + Schools (Day 2-3)
- Home screen with readiness score
- Schools list with match percentages
- School detail view with breakdown

### Phase 4: Sliders + Simulation (Day 3-4)
- Interactive sliders on profile
- Real-time recalculation
- "What If" mode
- Before/after comparison

### Phase 5: Timeline (Day 4-5)
- 4-year timeline view
- School-specific deadlines
- Current position tracking

### Phase 6: Polish + Deploy (Day 5-6)
- PWA manifest + service worker
- Cloudflare Pages deploy
- CF Access OTP protection
- QC pass

---

## Privacy
- Student data stored in Supabase (Zack controls)
- No selling of student data
- COPPA compliance needed (users under 13)
- FERPA awareness (school records)
- Clear privacy policy required

## Future Features (post-MVP)
- Essay review AI
- Scholarship matching
- Financial aid estimator
- Parent dashboard
- Counselor dashboard (B2B)
- More schools (500+)
- Flywheel: users report where they got in → proprietary outcomes data
