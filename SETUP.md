# Setup

Getting Scholara running on your machine. Budget about 45 minutes, most of it waiting on account signups.

---

## Part 1 — Run it locally (10 minutes)

You need **Node.js 20 or newer**. Check with `node --version`; if you don't have it, get it from https://nodejs.org

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000

**What works right now, with no accounts and no keys:** browsing all 60 schools, the full prediction algorithm, the algorithm explainer, What-If, the roadmap, favorites, and your profile. That's most of the app. Everything is stored in your browser and the algorithm runs locally.

**What doesn't work yet:** signing in, and the AI counselor. Those need the accounts below.

If the app asks you to sign in and blocks you, that's the auth gate. It stays inactive until you add Supabase keys in Part 2, so on a fresh checkout you should land straight in the app.

---

## Part 2 — Your own Supabase project (20 minutes)

**Do not ask for the production keys.** You'll create your own project, so your test data never touches real users' data. This is not busywork — it's the actual practice.

1. Sign up at https://supabase.com (the free tier is plenty).
2. Create a new project. Save the database password it gives you — it is not shown again.
3. In the left sidebar go to **SQL Editor**, click **New query**.
4. Open `migrations/supabase/0001_init.sql` from this repo, copy the whole file, paste it in, and hit **Run**. This creates all 10 tables and their security policies.
5. Go to **Project Settings → API** and copy two values: the **Project URL** and the **anon / public** key.
6. In the root of this repo, copy the example env file and fill it in:

```bash
cp .env.example .env.local
```

Open `.env.local` and paste your two values in. Then restart the dev server (`Ctrl+C`, then `npm run dev`).

Sign-in should now work. Magic-link emails will come from Supabase's built-in sender, which is capped at about 4 per hour — fine for development.

> **`.env.local` must never be committed.** It's already in `.gitignore`. Leave it that way.

### About row-level security

Every table in that migration has row-level security turned on, which means a signed-in user can only read and write their own rows — enforced by the database, not by the app code. If you add a table, add its policy in the same migration. A table without a policy is readable by everyone.

---

## Part 3 — The AI counselor (optional, 15 minutes)

Only do this if you're working on the chat feature.

1. Get a Gemini API key at https://aistudio.google.com/apikey
2. Add it to `.env.local`:

```
GEMINI_API_KEY=your-key-here
```

The chat runs through `functions/api/chat.js`, a Cloudflare Function. The key stays server-side and is never sent to the browser — keep it that way.

To run Cloudflare Functions locally you need Wrangler:

```bash
npx wrangler pages dev out
```

Run `npm run build` first so `out/` exists.

---

## Part 4 — Deploying (only when you're ready)

The app builds to a folder of static files:

```bash
npm run build
```

That produces `out/`, which is what gets deployed. Any static host works. The production app uses Cloudflare Pages:

```bash
npx wrangler pages deploy ./out --project-name your-project-name
```

You'll need your own Cloudflare account and your own D1 database if you want the event log. `wrangler.toml` in this repo points at the production database — change the `database_id` to your own before deploying anything.

---

## Common problems

**`npm install` fails.** Check your Node version is 20+. Delete `node_modules` and `package-lock.json`, then try again.

**Sign-in says "error sending confirmation email."** You've hit Supabase's built-in rate limit of roughly 4 emails per hour. Wait an hour, or wire up an email provider in Supabase under Authentication → SMTP Settings.

**Chat returns nothing and there's no error.** Almost always a missing `GEMINI_API_KEY`, or you're running `npm run dev` instead of Wrangler. Next.js's dev server does not run Cloudflare Functions.

**A page 404s after building.** This is a static export, so every route has to be known at build time. If you add a dynamic route, it needs a `generateStaticParams` function. Look at `app/schools/[unitid]/page.tsx` for the pattern.

**Changes to `data/schools.json` don't show up.** Restart the dev server. JSON is imported at build time, not watched.

**Sign-in works, but saving your profile fails with "We could not save your profile" and the browser console shows `permission denied for table profiles` (Postgres error `42501`).** Your Supabase project is missing the table-level grants for the `authenticated` role — RLS policies alone don't grant access, they only restrict it once baseline access exists. Re-run `migrations/supabase/0001_init.sql` in the SQL Editor (it's idempotent, safe to run again) to pick up the `grant` statements near the bottom, or run just these two lines directly:
```sql
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
```

---

## Getting oriented

A good first day: run it locally, make a profile for yourself with your real grades, and look at your results for a school you actually care about. Then open that school's algorithm-explainer page and read `app/lib/algorithm.ts` side by side until you can predict what the page will say before it renders.

Once you can do that, you understand the product.
