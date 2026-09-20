'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { track } from './events';
import { useUser } from './useAuth';
import { getSupabase } from './supabase';
import { LocalListStore, SupabaseListStore, ListStore } from './store/listStores';

const STORAGE_KEY = 'scholara_applying';

/**
 * Returns the list of school unitids the student has marked as "applying to",
 * plus a toggle. Same pattern as useFavorites — Supabase store when signed in,
 * localStorage otherwise. Optimistic local updates with write-through.
 */
export function useApplying() {
  const { user, isAuthEnabled } = useUser();
  const store: ListStore = useMemo(() => {
    if (isAuthEnabled && user) {
      return new SupabaseListStore(getSupabase(), user.id, 'applying');
    }
    return new LocalListStore(STORAGE_KEY);
  }, [isAuthEnabled, user]);

  const [applying, setApplying] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    store.load().then(list => {
      if (!cancelled) setApplying(list);
    }).catch(err => console.error('Applying load failed:', err));
    return () => { cancelled = true; };
  }, [store]);

  const toggle = useCallback(async (unitid: string) => {
    const wasApplying = applying.includes(unitid);
    const next = wasApplying ? applying.filter(u => u !== unitid) : [...applying, unitid];
    setApplying(next);
    track(wasApplying ? 'school_unmarked_applying' : 'school_marked_applying', { unitid });
    try {
      if (wasApplying) await store.remove(unitid);
      else await store.add(unitid);
    } catch (err) {
      console.error('Applying write failed, reloading:', err);
      const fresh = await store.load().catch(() => applying);
      setApplying(fresh);
    }
  }, [applying, store]);

  const isApplying = useCallback((unitid: string) => applying.includes(unitid), [applying]);

  return { applying, toggle, isApplying };
}
