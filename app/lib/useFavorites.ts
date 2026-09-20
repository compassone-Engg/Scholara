'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { track } from './events';
import { useUser } from './useAuth';
import { getSupabase } from './supabase';
import { LocalListStore, SupabaseListStore, ListStore } from './store/listStores';

export const MAX_FAVORITES = 10;
const STORAGE_KEY = 'scholara_favorites';

/**
 * Returns the current favorites + a toggle action. Picks the right backing
 * store (Supabase when signed in, localStorage otherwise) based on auth.
 *
 * Optimistic UI: state updates immediately on toggle, then writes through to
 * the store. Errors fall back to a reload of the store state.
 */
export function useFavorites() {
  const { user, isAuthEnabled } = useUser();
  const store: ListStore = useMemo(() => {
    if (isAuthEnabled && user) {
      return new SupabaseListStore(getSupabase(), user.id, 'favorites');
    }
    return new LocalListStore(STORAGE_KEY);
  }, [isAuthEnabled, user]);

  const [favorites, setFavorites] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // (Re)load whenever the store changes (e.g., sign-in/out).
  useEffect(() => {
    let cancelled = false;
    store.load().then(list => {
      if (!cancelled) setFavorites(list);
    }).catch(err => console.error('Favorites load failed:', err));
    return () => { cancelled = true; };
  }, [store]);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  };

  const toggle = useCallback(async (unitid: string) => {
    const wasFavorited = favorites.includes(unitid);
    if (!wasFavorited && favorites.length >= MAX_FAVORITES) {
      showToast(`You can only save up to ${MAX_FAVORITES} favorites. Remove one to add another.`);
      track('favorite_limit_hit', { unitid });
      return;
    }
    // Optimistic local update
    const next = wasFavorited ? favorites.filter(u => u !== unitid) : [...favorites, unitid];
    setFavorites(next);
    track(wasFavorited ? 'school_unfavorited' : 'school_favorited', { unitid });
    // Write through to the store; on failure, reload truth from the store
    try {
      if (wasFavorited) await store.remove(unitid);
      else await store.add(unitid);
    } catch (err) {
      console.error('Favorites write failed, reloading:', err);
      const fresh = await store.load().catch(() => favorites);
      setFavorites(fresh);
    }
  }, [favorites, store]);

  const isFavorited = useCallback((unitid: string) => favorites.includes(unitid), [favorites]);

  return { favorites, toggle, isFavorited, toast, MAX_FAVORITES };
}
