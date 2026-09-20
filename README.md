# Scholara

A college admissions predictor for high school students. Enter your academic profile, get an honest read on your chances at 60 colleges, and a four-year plan to improve them.

Live: https://scholara.metaba.ai

---

## Start here

Read these three, in this order. Together they take about an hour and will save you a week.

1. **`METHODOLOGY.html`** — open it in a browser. This is the most important document in the repo. It explains exactly how the algorithm computes a prediction, where every number comes from, all 77 data sources we evaluated, and a frank list of what the algorithm gets wrong. If you only read one thing, read this.
2. **`SETUP.md`** — how to get it running on your machine.
3. **`SPEC.md`** — the original product spec: what Scholara is for and who it serves.

Then `docs/feedback-changelog.md` if you want the history of why things are shaped the way they are — every piece of feedback we got, what we changed, and what we deliberately chose *not* to build.

---

## What this is built with

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, static export) + React 19 |
| Styling | Inline styles + Tailwind 4 |
| Hosting | Cloudflare Pages |
| Server code | Cloudflare Pages Functions (`functions/`) |
| Database + auth | Supabase (Postgres + magic-link auth) |
| Event log | Cloudflare D1 |
| AI counselor | Google Gemini, via a server-side proxy |

The whole app is a **static export**. There is no Node server. Every page is pre-rendered HTML, and the prediction algorithm runs in the user's browser — which means predictions work offline.

---

## Map of the code

```
app/                      the UI (Next.js App Router)
  lib/
    algorithm.ts          ← the prediction algorithm. Start here.
    types.ts              ← every data shape in the app
    chanceBand.ts         ← turns a raw % into a display band
    benchmarks.ts         ← peer-comparison figures from the Common Data Set
    store/                ← how data is saved (local vs. cloud)
  schools/                school list, school detail, algorithm-explainer
  chat/                   the AI counselor
  onboarding/             first-run profile setup
  profile/                edit your profile
  timeline/               the four-year roadmap

functions/                server-side code, runs on Cloudflare
  api/chat.js             AI counselor proxy (keeps the API key server-side)
  api/events.js           anonymized usage events
  lib/                    shared server logic

data/
  schools.json            ← all 60 schools. The single source of truth.
  checklists.json         per-school application checklists

migrations/
  0001_init.sql           Cloudflare D1 schema (events)
  0002_chat.sql           D1 chat telemetry
  supabase/0001_init.sql  ← Supabase schema: 10 tables, all with row-level security

public/
  methodology.html        the methodology document (also copied to the root as METHODOLOGY.html)
```

**If you're trying to understand the product, read `app/lib/algorithm.ts` first.** It's 370 lines and it's the whole thing. Everything else is presentation.

---

## The algorithm in one paragraph

For each school, compute four scores between 0 and 1: how the student's GPA compares to that school's admitted-student GPA distribution, how their test score sits in that school's 25th–75th percentile range, how their course rigor compares to what that tier of school expects, and how strong their activities are. Combine those four using *that school's own weights* (pulled from its Common Data Set), add small bonuses for early decision, early action, legacy, and first-generation status, and you get a 0–100 score. Map the score to a category (Safety / Match / Reach / Far Reach) using thresholds that shift with the school's real acceptance rate, and convert it to a percentage chance anchored to that acceptance rate. Show the student the category and a 10-point band — never the raw score.

Every one of those steps is spelled out with formulas in `METHODOLOGY.html`.

---

## Things worth knowing before you change anything

**We show bands, not exact percentages.** "10–20%", never "13%". A single number implies precision the algorithm doesn't have. This was a deliberate reversal of an earlier design — see the changelog.

**We don't show the 0–100 match score to students.** It's computed and used internally, but the student sees a category and a band. On the algorithm-explainer page we show each factor's *weight at that school* instead of the student's score on it, because a weight is actionable and a score is just a grade.

**Feedback copy is deliberately positive and grade-aware.** A 9th grader and a 12th grader get different framing for the same gap. Don't write anything that reads as a verdict.

**The per-school weights are a judgment call, and we know it.** The Common Data Set gives colleges' self-reported labels ("Very Important", "Important", "Considered", "Not Considered"). We converted those labels into numbers. The ordering follows the labels; the exact spacing is ours. This is the single most defensible thing to improve.

**The algorithm is rules-based, not machine-learned.** We don't train on real admit/deny outcomes. The weights and bonuses are informed guesses, not fitted values. Fixing this is the highest-value project available to you — see below.

---

## Good projects to pick up

Roughly ordered by value-to-effort. The methodology document's "Known limitations" section has the full list with detail.

1. **Per-major selectivity.** We collect intended major but score everyone against the institution-wide acceptance rate. CS at Carnegie Mellon and Berkeley EECS admit at a small fraction of the university rate. This is the biggest accuracy gap in the product.
2. **Per-school early-decision uplift.** The ED bonus is a flat +12 points everywhere. Real ED advantage varies enormously by school. Section C2 of each school's Common Data Set has the actual ED applied/admitted numbers — nobody has parsed them yet.
3. **Expand past 60 schools.** The bottleneck is Common Data Set coverage, not code. See the methodology document for exactly which two fields block a school from being added.
4. **Fit the weights against real outcomes.** The r/collegeresults archive is cataloged in the methodology sources table and already downloaded. This turns the algorithm from rules-based into evidence-based.
5. **Finish the cloud migration.** Profile, favorites, and applying lists are in Supabase. Milestones, roadmap progress, and checklists still write to browser storage. The interfaces are already cloud-shaped — see `app/lib/store/`.
6. **Account deletion.** There's no self-serve way to delete an account. Required before any public launch, and required by Apple if this ever ships as an iOS app.

---

## Ground rules

**Never commit an API key, database password, or service-role key.** This package ships with no credentials on purpose. `SETUP.md` walks you through creating your own. If you're ever unsure whether something is a secret, assume it is.

**`data/schools.json` is the source of truth for school data.** Don't hardcode a school's numbers anywhere else in the app.

**If you change the algorithm, update `METHODOLOGY.html` in the same commit.** The document being accurate is the whole point of it existing. A methodology document that quietly drifts out of sync with the code is worse than no document.
