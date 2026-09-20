'use client';

import { useCallback, useEffect, useState } from 'react';
import { ROADMAP_DATA, RoadmapGrade, itemsForGrade } from './roadmap';

/**
 * Roadmap completion record. One per (userId, itemId).
 * Same cloud-shaped pattern as milestones: easy port to Supabase.
 *
 * Future Postgres table:
 *   create table roadmap_completions (
 *     user_id uuid not null,
 *     item_id text not null,
 *     completed_at timestamptz not null default now(),
 *     primary key (user_id, item_id)
 *   );
 */
export interface RoadmapCompletion {
  userId: string;      // 'local' until auth ships
  itemId: string;      // matches ROADMAP_DATA[].id
  completedAt: string; // ISO 8601 UTC
}

const STORAGE_KEY = 'scholara_roadmap_completions';
const LOCAL_USER_ID = 'local';

function safeRead(): RoadmapCompletion[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWrite(records: RoadmapCompletion[]): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); } catch { /* ignore quota errors */ }
}

/**
 * Hook providing roadmap completion state + setters.
 * Reads from localStorage on mount; writes through on every change.
 */
export function useRoadmap() {
  const [completions, setCompletions] = useState<RoadmapCompletion[]>([]);

  useEffect(() => { setCompletions(safeRead()); }, []);

  const isDone = useCallback((itemId: string): boolean => {
    return completions.some(c => c.userId === LOCAL_USER_ID && c.itemId === itemId);
  }, [completions]);

  const setDone = useCallback((itemId: string, done: boolean) => {
    setCompletions(prev => {
      const next = done
        ? prev.some(c => c.userId === LOCAL_USER_ID && c.itemId === itemId)
          ? prev
          : [...prev, { userId: LOCAL_USER_ID, itemId, completedAt: new Date().toISOString() }]
        : prev.filter(c => !(c.userId === LOCAL_USER_ID && c.itemId === itemId));
      safeWrite(next);
      return next;
    });
  }, []);

  const toggle = useCallback((itemId: string) => {
    const currentlyDone = completions.some(c => c.userId === LOCAL_USER_ID && c.itemId === itemId);
    setDone(itemId, !currentlyDone);
  }, [completions, setDone]);

  const doneCountForGrade = useCallback((grade: RoadmapGrade): { done: number; total: number } => {
    const items = itemsForGrade(grade);
    const total = items.length;
    const done = items.filter(i => completions.some(c => c.userId === LOCAL_USER_ID && c.itemId === i.id)).length;
    return { done, total };
  }, [completions]);

  const doneCountTotal = useCallback((): { done: number; total: number } => {
    const total = ROADMAP_DATA.length;
    const done = completions.filter(c => c.userId === LOCAL_USER_ID).length;
    return { done, total };
  }, [completions]);

  return { completions, isDone, setDone, toggle, doneCountForGrade, doneCountTotal };
}
