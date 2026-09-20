// Supabase client singleton (browser-side).
//
// Reads URL + anon key from NEXT_PUBLIC_* env vars. The anon key is safe to
// ship in the client bundle — RLS policies in the database enforce what each
// user can actually read/write.
//
// Server-side functions (Cloudflare Pages Functions) get the service_role key
// from a separate, server-only env var. They do NOT use this singleton.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let client: SupabaseClient | null = null;

/**
 * Returns the singleton Supabase client. Throws if env is misconfigured —
 * we want to fail loudly during local dev rather than silently no-op.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Supabase env not configured. Set NEXT_PUBLIC_SUPABASE_URL and ' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY in the build env.'
    );
  }
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      // Persist session in localStorage so logged-in users survive page reloads.
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // handles magic-link callback automatically
      // Keep the storage key namespaced so we don't collide with our own
      // localStorage keys during the migration window.
      storageKey: 'scholara_supabase_auth',
    },
  });
  return client;
}

/**
 * True if Supabase env is configured. Used to gate the auth UI from rendering
 * before the env vars are deployed.
 */
export function hasSupabaseEnv(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
