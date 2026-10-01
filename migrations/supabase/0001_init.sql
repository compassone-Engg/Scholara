-- Scholara cloud schema — Supabase / Postgres.
--
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run.
--
-- This is idempotent (uses IF NOT EXISTS / CREATE OR REPLACE) so it's safe
-- to re-run if you need to adjust anything mid-migration.
--
-- Schema design notes:
--   - Every user-data table is keyed on user_id (uuid) referencing auth.users.
--   - On delete cascade so account deletion sweeps user data.
--   - Row-Level Security (RLS) is enabled and enforced on every table.
--   - The shapes mirror the existing localStorage schemas in app/lib/
--     (milestones.ts, useRoadmap.ts) so client code changes are minimal.

-- ─── Extensions ──────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";

-- ─── Profiles (1:1 with auth.users) ──────────────────────────────────────────
-- Mirrors the StudentProfile interface in app/lib/types.ts.
-- Flattened from JSON to columns where it makes sense; activities/AP courses
-- stay as JSONB because they're nested arrays of objects.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  nickname text not null default '',
  grade smallint check (grade is null or grade in (9,10,11,12)),
  state text not null default '',
  high_school text not null default '',
  gender text not null default '',
  ethnicity text not null default '',
  intended_major text not null default '',
  first_gen boolean not null default false,
  legacy_schools text[] not null default '{}',
  early_decision_school text,                       -- unitid or null
  early_action_school text,                         -- unitid or null
  gpa_unweighted numeric(3,2),
  gpa_weighted numeric(3,2),
  class_rank text not null default 'unknown',
  sat_score integer,
  act_score integer,
  psat_score integer,
  ap_courses jsonb not null default '[]'::jsonb,    -- APCourse[]
  ib_program boolean not null default false,
  honors_count integer not null default 0,
  activities jsonb not null default '[]'::jsonb,    -- Activity[]
  awards_count integer not null default 0,
  total_hours_per_week integer not null default 0,
  plan_early_decision boolean not null default false,
  plan_early_action boolean not null default false,
  onboarding_complete boolean not null default false,
  analytics_opted_out boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-update the updated_at column on any change to profiles.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row when a new auth.user is created.
-- This means the app's signup flow can immediately upsert profile fields
-- without first having to check whether the row exists.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Favorites ───────────────────────────────────────────────────────────────

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  unitid text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, unitid)
);
create index if not exists idx_favorites_user on public.favorites (user_id);

-- ─── Applying ────────────────────────────────────────────────────────────────

create table if not exists public.applying (
  user_id uuid not null references auth.users(id) on delete cascade,
  unitid text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, unitid)
);
create index if not exists idx_applying_user on public.applying (user_id);

-- ─── Checklist progress (per-school per-task completion) ────────────────────
-- Replaces the dynamic `scholara_checklist_{unitid}` localStorage keys.

create table if not exists public.checklist_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  unitid text not null,
  task_id text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, unitid, task_id)
);
create index if not exists idx_checklist_user on public.checklist_progress (user_id);

-- ─── Milestones (append-only event log) ─────────────────────────────────────
-- Direct port of MilestoneEvent in app/lib/milestones.ts. Already cloud-shaped.

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  key text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
-- Dedup: at most one event per (user, kind, key) when key is set.
create unique index if not exists milestones_dedup
  on public.milestones (user_id, kind, key) where key is not null;
create index if not exists idx_milestones_user_created
  on public.milestones (user_id, created_at desc);

-- ─── Roadmap completions ────────────────────────────────────────────────────
-- Direct port of RoadmapCompletion in app/lib/useRoadmap.ts.

create table if not exists public.roadmap_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
create index if not exists idx_roadmap_user on public.roadmap_completions (user_id);

-- ─── Chat conversations + messages ──────────────────────────────────────────
-- Replaces localStorage chat history. user_id is denormalized onto messages
-- so RLS can be enforced per-row without a join.

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index if not exists idx_chat_conv_user
  on public.chat_conversations (user_id, last_message_at desc);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('user','assistant')),
  content text not null,
  tool_calls jsonb,
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);
create index if not exists idx_chat_messages_conv_created
  on public.chat_messages (conversation_id, created_at);

-- Daily message cap, per-user. Replaces the D1 chat_rate_limit table.
create table if not exists public.chat_rate_limit (
  user_id uuid not null,
  day date not null,
  message_count integer not null default 0,
  last_message_at timestamptz not null default now(),
  primary key (user_id, day)
);
create index if not exists idx_rate_limit_day on public.chat_rate_limit (day);

-- ─── Telemetry events ───────────────────────────────────────────────────────
-- Replaces the D1 student_events table; now keyed on user_id.

create table if not exists public.student_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event_type text not null,
  payload jsonb,
  app_version text,
  client_timestamp timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_events_user_created on public.student_events (user_id, created_at desc);
create index if not exists idx_events_type on public.student_events (event_type);

-- ─── Row-Level Security ─────────────────────────────────────────────────────
-- Every table above has RLS enabled with the same pattern:
--   users can SELECT/INSERT/UPDATE/DELETE only their own rows.
-- The service_role key bypasses RLS, used only by server functions for
-- privileged operations (chat rate-limit increments, telemetry inserts, etc.).

alter table public.profiles            enable row level security;
alter table public.favorites           enable row level security;
alter table public.applying            enable row level security;
alter table public.checklist_progress  enable row level security;
alter table public.milestones          enable row level security;
alter table public.roadmap_completions enable row level security;
alter table public.chat_conversations  enable row level security;
alter table public.chat_messages       enable row level security;
alter table public.chat_rate_limit     enable row level security;
alter table public.student_events      enable row level security;

-- ─── Table-level grants ─────────────────────────────────────────────────────
-- RLS policies alone are not enough: Postgres requires the `authenticated`
-- role to hold baseline table-level privileges before an operation is even
-- attempted, independently of what any policy below allows. Tables created
-- via raw SQL (as here) do NOT get this automatically the way tables created
-- through Supabase's Table Editor UI do. Without this grant, every query from
-- a signed-in user fails with "permission denied for table ..." (Postgres
-- error 42501), even when every policy below is written correctly.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
-- Also cover any table added to this schema later, so a new table doesn't
-- silently reintroduce this same bug.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- ─── Policies ──
-- Pattern: own-row access only. auth.uid() is the user's auth ID.

-- profiles (PK is id, not user_id)
drop policy if exists "profiles_own_select" on public.profiles;
drop policy if exists "profiles_own_insert" on public.profiles;
drop policy if exists "profiles_own_update" on public.profiles;
drop policy if exists "profiles_own_delete" on public.profiles;
create policy "profiles_own_select" on public.profiles for select using (auth.uid() = id);
create policy "profiles_own_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_own_update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_own_delete" on public.profiles for delete using (auth.uid() = id);

-- favorites
drop policy if exists "favorites_own_select" on public.favorites;
drop policy if exists "favorites_own_insert" on public.favorites;
drop policy if exists "favorites_own_delete" on public.favorites;
create policy "favorites_own_select" on public.favorites for select using (auth.uid() = user_id);
create policy "favorites_own_insert" on public.favorites for insert with check (auth.uid() = user_id);
create policy "favorites_own_delete" on public.favorites for delete using (auth.uid() = user_id);

-- applying
drop policy if exists "applying_own_select" on public.applying;
drop policy if exists "applying_own_insert" on public.applying;
drop policy if exists "applying_own_delete" on public.applying;
create policy "applying_own_select" on public.applying for select using (auth.uid() = user_id);
create policy "applying_own_insert" on public.applying for insert with check (auth.uid() = user_id);
create policy "applying_own_delete" on public.applying for delete using (auth.uid() = user_id);

-- checklist_progress
drop policy if exists "checklist_own_select" on public.checklist_progress;
drop policy if exists "checklist_own_insert" on public.checklist_progress;
drop policy if exists "checklist_own_update" on public.checklist_progress;
drop policy if exists "checklist_own_delete" on public.checklist_progress;
create policy "checklist_own_select" on public.checklist_progress for select using (auth.uid() = user_id);
create policy "checklist_own_insert" on public.checklist_progress for insert with check (auth.uid() = user_id);
create policy "checklist_own_update" on public.checklist_progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "checklist_own_delete" on public.checklist_progress for delete using (auth.uid() = user_id);

-- milestones (append-only — no update/delete from client; server-only)
drop policy if exists "milestones_own_select" on public.milestones;
drop policy if exists "milestones_own_insert" on public.milestones;
create policy "milestones_own_select" on public.milestones for select using (auth.uid() = user_id);
create policy "milestones_own_insert" on public.milestones for insert with check (auth.uid() = user_id);

-- roadmap_completions
drop policy if exists "roadmap_own_select" on public.roadmap_completions;
drop policy if exists "roadmap_own_insert" on public.roadmap_completions;
drop policy if exists "roadmap_own_delete" on public.roadmap_completions;
create policy "roadmap_own_select" on public.roadmap_completions for select using (auth.uid() = user_id);
create policy "roadmap_own_insert" on public.roadmap_completions for insert with check (auth.uid() = user_id);
create policy "roadmap_own_delete" on public.roadmap_completions for delete using (auth.uid() = user_id);

-- chat_conversations
drop policy if exists "chat_conv_own_select" on public.chat_conversations;
drop policy if exists "chat_conv_own_insert" on public.chat_conversations;
drop policy if exists "chat_conv_own_update" on public.chat_conversations;
drop policy if exists "chat_conv_own_delete" on public.chat_conversations;
create policy "chat_conv_own_select" on public.chat_conversations for select using (auth.uid() = user_id);
create policy "chat_conv_own_insert" on public.chat_conversations for insert with check (auth.uid() = user_id);
create policy "chat_conv_own_update" on public.chat_conversations for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "chat_conv_own_delete" on public.chat_conversations for delete using (auth.uid() = user_id);

-- chat_messages
drop policy if exists "chat_msg_own_select" on public.chat_messages;
drop policy if exists "chat_msg_own_insert" on public.chat_messages;
create policy "chat_msg_own_select" on public.chat_messages for select using (auth.uid() = user_id);
create policy "chat_msg_own_insert" on public.chat_messages for insert with check (auth.uid() = user_id);

-- chat_rate_limit — server-only writes (service_role bypasses RLS).
-- No client-facing policies needed; clients never touch this table directly.

-- student_events — server-only writes, but clients can read their own.
drop policy if exists "events_own_select" on public.student_events;
create policy "events_own_select" on public.student_events for select using (auth.uid() = user_id);

-- ─── Done ──
-- After running this, verify in Supabase Dashboard → Database → Tables.
-- You should see 10 tables under "public" schema, all with the lock icon
-- indicating RLS is enabled.
