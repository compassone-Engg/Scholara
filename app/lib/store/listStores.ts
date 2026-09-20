// Favorites + Applying stores.
//
// Both are conceptually "a per-user list of school unitids" so they share an
// interface (ListStore). Two implementations:
//   - LocalListStore  → reads/writes a localStorage key holding string[]
//   - SupabaseListStore → reads/writes a one-row-per-(user, unitid) Postgres
//                         table. Single-row inserts and deletes; no upsert race.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ListStore {
  /** Load the full list. */
  load(): Promise<string[]>;
  /** Add a unitid. Idempotent. */
  add(unitid: string): Promise<void>;
  /** Remove a unitid. Idempotent (no error if not present). */
  remove(unitid: string): Promise<void>;
}

// ─── Local (legacy / unauth fallback) ────────────────────────────────────────

export class LocalListStore implements ListStore {
  constructor(private storageKey: string) {}

  async load(): Promise<string[]> {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async add(unitid: string): Promise<void> {
    const list = await this.load();
    if (list.includes(unitid)) return;
    list.push(unitid);
    this.write(list);
  }

  async remove(unitid: string): Promise<void> {
    const list = await this.load();
    const next = list.filter(u => u !== unitid);
    this.write(next);
  }

  private write(list: string[]): void {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(this.storageKey, JSON.stringify(list)); } catch { /* quota */ }
  }
}

// ─── Supabase (cloud) ────────────────────────────────────────────────────────

/**
 * Backed by either the `favorites` or `applying` table. Both have the same
 * shape: (user_id, unitid, created_at) with composite PK on (user_id, unitid).
 */
export class SupabaseListStore implements ListStore {
  constructor(private sb: SupabaseClient, private userId: string, private table: 'favorites' | 'applying') {}

  async load(): Promise<string[]> {
    const { data, error } = await this.sb
      .from(this.table)
      .select('unitid')
      .eq('user_id', this.userId);
    if (error) {
      console.error(`${this.table} load failed:`, error);
      return [];
    }
    return (data ?? []).map((r: { unitid: string }) => r.unitid);
  }

  async add(unitid: string): Promise<void> {
    // upsert avoids race conditions if the row was concurrently added on
    // another device. ignoreDuplicates makes it a true no-op when present.
    const { error } = await this.sb
      .from(this.table)
      .upsert({ user_id: this.userId, unitid }, { onConflict: 'user_id,unitid', ignoreDuplicates: true });
    if (error) throw error;
  }

  async remove(unitid: string): Promise<void> {
    const { error } = await this.sb
      .from(this.table)
      .delete()
      .eq('user_id', this.userId)
      .eq('unitid', unitid);
    if (error) throw error;
  }
}
