# Scholara — Feedback Implementation Log

**Project:** Scholara (college admissions predictor)
**Period:** TYE 2026 demo prep cycle
**Author:** Engineering (Claude pair)
**Last updated:** 2026-05-30

This document captures every piece of feedback received during the TYE 2026 demo prep cycle, what we did about it, the reasoning, and what we deliberately deferred to post-MVP. It pulls from the original 21-item PDF feedback punch list, follow-on directives from Zack during build sessions, and the cloud-migration plan that grew out of "this can't ship behind Basic Auth."

---

## 1. Master summary table

Status legend: **Shipped** = live on scholara.metaba.ai · **Deferred** = explicitly punted to post-MVP · **Replaced** = original ask superseded by a better design · **N/A** = out of scope for MVP demo

### 1.1 PDF punch list (items 1–19)

| # | Feedback | What we did | Why | Status |
|---|---|---|---|---|
| 1 | Drop "and Counselors" from landing tagline | Removed the trailing phrase; landing now reads as a student-first product. | Counselor-side is post-MVP B2B; including it muddied the demo positioning. | Shipped |
| 2 | Fix `Here&rsquo;s` HTML entity on Home greeting | Switched the template to render the apostrophe correctly. | Pure rendering bug — straight fix. | Shipped |
| 3 | Rename "Deadlines" → "Application Submission Deadline" | Renamed the label everywhere it surfaced (Home card, school detail, checklist). | "Deadlines" was ambiguous (FAFSA? scholarship? app?). Explicit label removes guesswork for first-time users. | Shipped |
| 4 | Drop "honest, not chipper" subtitle in Counselor header | Removed the subtitle. | The line was internal voice guidance, not user-facing copy. | Shipped |
| 5 | Hide "tools: ..." debug leak in counselor chat | Stripped the debug tool-trace from the visible bubble; kept it in the event log for telemetry. | Demo polish — debug artifacts undercut the "this is a real product" perception. | Shipped |
| 6 | Remove pre-filled junior/CA/gender defaults from onboarding | Onboarding fields now start empty; user must choose. | Pre-filled defaults made the product feel like it had already assumed things about the user, which hurt the personalization story. | Shipped |
| 7 | Move Live Match Summary from Profile to Home | Lifted the live summary card from `/profile` onto Home. | Profile became a settings page; the daily-driver surface is Home. The match summary is the most-checked widget — it belongs where the user lands. | Shipped |
| 8 | Add Intended Major field to onboarding + profile | Added a free-text major field with autocomplete-ish suggestions, persisted to profile. | The algorithm already weighted intended major; we were just inferring it. Asking directly is more honest and improves prediction quality. | Shipped |
| 9 | Add ED / EA / legacy controls to Profile | Added per-school ED / EA selection + legacy multi-select to Profile. | Original ask was "controls on Profile." See 9b for the refinement. | Shipped |
| 9b | Make ED/EA per-school + legacy = favorites ∪ applying | Reworked so ED/EA are stored against individual schools (not a single global flag), and legacy is computed as the union of favorites + applying lists. | A student can only ED one school but may EA several; modeling it as a single field was wrong. Legacy is inherently school-scoped, so re-asking the student per-school doubled UI without value. | Shipped |
| — | ED/EA badges on school cards | Added badge chips on Schools list rows + School detail header. | Once ED/EA are per-school, students need to *see* which school they've designated. Card was the natural place. | Shipped |
| 10 | Mark each AP as taken / taking / will take | AP courses now carry a three-state status instead of a single "took it" checkbox. | A junior in AP Chem mid-year is in a different position than a senior who's already scored. Conflating them hurt prediction accuracy. | Shipped |
| 11 | Other AP free-text input | Added an "Other AP" free-text field on the AP course list. | The dropdown can't enumerate every district's offering. Free-text catches the long tail without forcing us to maintain an exhaustive list. | Shipped |
| 12 | Activities split (academic vs other clubs) | Split the single Activities section into Academic Activities and Other Clubs. | Admissions weights these differently. Surfacing the distinction also nudges students to think about academic depth. | Shipped |
| 13 | SAT/ACT submission mode (default higher, per-school override) | Added a submission-mode toggle: by default we submit the higher score; per-school the student can override to test-optional. | Test-optional strategy is school-specific. A global toggle was too coarse; asking per-school every time was too noisy. Default + override hits the right balance. | Shipped |
| 14 | Ask high school in onboarding + profile | Added a High School field to onboarding and profile. | Needed for the legacy/feeder-school signals planned for post-MVP, and useful demographic context now. | Shipped |
| 15 | (Renumbered / merged into items 16–17 during scoping) | — | Item slid during scoping — see 16/17. | N/A |
| 16 | Home: grade + major chip; This Month section w/ Next Month toggle | Added a grade+major chip at the top of Home and a "This Month" timeline section with a Next Month peek. | Home was static. Adding grade-aware "what should I be doing right now" content gave it daily-return value. | Shipped |
| 17 | Peer benchmarks card on Home (CDS-derived only) | Built a benchmarks library that pulls only Common Data Set figures, mounted it on Home, School Detail, the Algorithm page, the AI counselor tool surface, the test-optional toggle, the Legacy section, and the onboarding completion screen. | Benchmarks were the highest-signal feedback item. Once we had the library, surfacing it everywhere a student makes a decision was cheap. | Shipped |
| 18 | Milestones system | Added a milestones library + detection hook + toast component + "Recent achievements" section on Profile. 14 milestone kinds. | Pure engagement play — celebrating progress makes the app feel rewarding to use, which matters for a daily-return product. Cloud-shaped schema from day one. | Shipped |
| 19 | Roadmap (4-year, checkable items, grade-lock) | Built a Roadmap with stable IDs, `useRoadmap` hook on cloud-shaped storage, a TimelineClient refactor with checkboxes + grade-lock, a Roadmap bottom-nav tab, and a Home roadmap-progress card. | The Timeline page existed but was read-only and static. Making items checkable + grade-locked turns it into a real planning tool. | Shipped |

### 1.2 Follow-on directives (during build sessions)

| Item | What we did | Why | Status |
|---|---|---|---|
| Bubble cutoff on long counselor responses | Fixed the chat bubble overflow so long answers wrap and scroll cleanly. | Long Gemini answers were getting clipped, undercutting confidence in the tool. | Shipped |
| Soft-confirm when marking a far reach as Applying | Added a confirmation prompt when a student marks a school as Applying that's well below their predicted band. | Prevents accidental applies and frames hard schools honestly without blocking the student. | Shipped |
| Positive, grade-aware feedback tone | Rewrote all generated feedback strings to lead with what's going well and frame gaps as opportunities, with copy that flexes by grade. | Zack's explicit ask: "let's make it with a very positive vibe." Especially important for 9th/10th graders who can still change a lot. | Shipped |
| Nickname field + use it everywhere | Added a nickname field in onboarding/profile; substituted it into all greetings and feedback strings. | Personalization. "Hey, Sam" beats "Hey, Samuel" for a daily-driver. | Shipped |
| What-If: bigger green deltas, sticky top, entry button | Promoted the green delta numbers, made the header sticky on scroll, added a clear entry button from Home. | What-If is the "aha" surface; we were under-selling it visually. | Shipped |
| Replace match score with chance bands across UI | Swapped the numeric match score for chance bands (Reach / Target / Likely / Safety) everywhere. | Numeric scores invited false precision and stress. Bands communicate the same info without implying 3-decimal-place accuracy. | Shipped (Replaced) |
| Drop component score, surface weight on algorithm page | Removed the per-component numeric "score"; replaced with the relative weight each factor carries. | Same reason as above — numbers students can't act on aren't useful. Weights tell them where to focus. | Shipped (Replaced) |
| App-type buttons show chance delta + band end-state | The ED/EA/RD buttons now preview the delta and resulting band when toggled. | Makes the strategy decision concrete: "ED here moves me from Target to Likely" beats abstract advice. | Shipped |
| ED/EA badges on school cards (already listed above) | — | — | Shipped |

### 1.3 Cloud-migration plan (TYE shippability)

Triggered by: "this needs to be cloud, not localStorage, before we demo."

| Phase | What | Status |
|---|---|---|
| 0a | Write Supabase SQL migration (10 tables, RLS policies, auth trigger for blank profile row) | Shipped |
| 0b | Supabase client + auth scaffolding (`useAuth`, `useUser`, magic link sender, callback page) | Shipped |
| 1a | Auth-gate `AppShell` (splash if no user, full app if signed in) | Shipped |
| 1b | Sign-out + email display on Profile (AccountControls) | Shipped |
| 1c | Wire Resend SMTP into Supabase Auth | Shipped |
| — | Remove Basic Auth middleware (magic link is the only gate) | Shipped |
| 2a | `ProfileStore` interface + Local/Supabase implementations | Shipped |
| 2b | Refactor `AppProvider` to use ProfileStore | Shipped |
| 3a | Favorites store (Local + Supabase) | Shipped |
| 3b | Applying store (Local + Supabase) | Shipped |
| — | Verify `scholara.metaba.ai` in Resend (DKIM + SPF MX + SPF TXT) | Shipped |
| — | Update Supabase SMTP sender to `noreply@scholara.metaba.ai` | Shipped |
| 4 | Milestones + Roadmap stores migration | Deferred (next) |
| 5 | Checklist progress migration | Deferred |
| 6 | Chat conversation/message migration | Deferred |
| 7–12 | Telemetry, migration UX, deprecation paths, hardening | Deferred |

### 1.4 Data refresh

| Item | What | Why | Status |
|---|---|---|---|
| IPEDS 2024-25 provisional refresh | Refreshed `schools.json` against the IPEDS 2024-25 provisional release: 204 field updates across 60 schools. | TYE demo needs the freshest enrollment + admit-rate figures the field has. CDS-derived benchmarks layer on top. | Shipped |

---

## 2. Why we *didn't* do some things (or pushed them past MVP)

These are items where the feedback was real but we made a deliberate call to defer.

| Item | Decision | Why |
|---|---|---|
| Counselor-side product / dashboard | Deferred (post-MVP B2B) | This is a separate product surface and a separate sales motion. Including it in MVP would force compromises on both the student UX and the counselor UX. Already noted in SPEC.md "Future Features." Driving directive: drop "and Counselors" from the tagline (item #1). |
| Essay review AI | Deferred (post-MVP) | Quality bar is brutal — a half-baked essay reviewer would actively harm the brand. Worth building only when we can do it well. |
| Scholarship matching | Deferred (post-MVP) | Sourcing scholarship data is its own infrastructure problem. Out of scope for a predictor-focused MVP. |
| Financial aid estimator | Deferred (post-MVP) | Needs accurate net-price calculator integration per school. Big lift, low impact for the predictor pitch. |
| Parent dashboard | Deferred (post-MVP) | Multi-user permissions model isn't in scope yet. Once we have it we can add parent/guardian roles cleanly. |
| Expand to 500+ schools | Deferred (post-MVP) | 60 schools covers the demo and the high-traffic targets. Scaling the school list is straightforward but needs CDS-collection automation that doesn't exist yet. |
| Outcomes flywheel (users self-report admit results) | Deferred (post-MVP) | Requires a return-loop UI + verification model. Genuinely valuable but not on the demo critical path. |
| COPPA / under-13 gate | Deferred (no age gate now) | Explicit Zack call: "no age gate now." Scholara's audience is 14+. We'll add the gate when we open registration to the general public. |
| Google OAuth sign-in | Deferred | Explicit Zack call: "magic link only." Keeps the auth surface tiny and avoids managing OAuth secrets in pre-launch. |
| Cloud migration phases 4–12 | Deferred (post-demo) | The TYE demo needs auth + profile + favorites + applying in the cloud. Milestones / Roadmap / Checklist / Chat are still cloud-shaped locally and will swap to Supabase storage without UI changes. We chose to stop at phase 3 so the demo wasn't risked by last-minute storage churn. |
| Free tier headroom / paid tier | Deferred | "All free for now" — Zack. Supabase + Resend + Cloudflare Pages all sit on free tiers that cover <100 users comfortably. We'll revisit pricing only when growth forces it. |
| Component-score breakdown on the Algorithm page | Replaced (not deferred) | Original UI showed per-factor numeric scores. We dropped them in favor of relative weights because students can't act on a "0.42 academic fit" — they *can* act on "academics is 35% of your prediction, here's how to move it." |
| Numeric match score | Replaced (not deferred) | Numeric % score → Reach/Target/Likely/Safety band. False precision was actively harmful for stress-prone users. |
| Honest, not chipper subtitle | Replaced (not deferred) | Internal voice guidance shouldn't ship in the UI. The principle stayed (see §1.2 "Positive, grade-aware feedback tone"). |

---

## 3. How we made decisions

A few patterns guided which items shipped vs. got deferred:

1. **Demo critical path first.** Anything that changed how the product *feels* in a 5-minute demo (Home rework, chance bands, milestones, what-if polish, benchmarks) shipped. Anything that only matters at scale (parent dashboard, B2B counselor, 500+ schools) deferred.
2. **Cloud-shaped storage from day one.** We built every new feature against an interface (`ProfileStore`, `ListStore`, etc.) with both a Local (legacy / unauth) and a Supabase (cloud) implementation. That meant the cloud migration was a wiring exercise, not a rewrite — and the deferred phases (4–6) are safe to ship post-demo without touching components.
3. **Replace false precision with honest framing.** Numeric scores, component-by-component breakdowns, and pre-filled assumptions all got dropped or replaced because they communicated certainty we couldn't justify.
4. **Personalization that respects effort.** Nicknames, intended major, per-school ED/EA, AP three-state, activities split — every one of these costs the student a few seconds and pays back in better predictions and a product that feels like it remembers them.
5. **Lower the auth surface for MVP.** Magic link only, no Google OAuth, no age gate, no COPPA flow yet. We'll layer those in when growth or compliance forces it.

---

## 4. What's next (immediate post-demo)

In rough order:

1. **Verify magic-link delivery end-to-end** with `noreply@scholara.metaba.ai` as sender (Resend domain just verified; Supabase SMTP just updated).
2. **Cloud migration phase 4** — Milestones + Roadmap stores swap to Supabase. Already cloud-shaped, so this is mostly storage wiring.
3. **Cloud migration phase 5** — Checklist progress.
4. **Cloud migration phase 6** — Chat conversations + messages (biggest remaining piece).
5. **Phases 7–12** — telemetry, migration UX for legacy localStorage users, deprecation, hardening.
6. **Post-MVP backlog** — essay review, scholarship matching, financial aid estimator, parent/counselor dashboards, school list expansion, outcomes flywheel.

---

*End of document.*
