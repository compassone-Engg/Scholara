'use client';

import { useEffect, useRef, useState } from 'react';
import { useApp } from './context';
import { useFavorites } from './useFavorites';
import { useApplying } from './useApplying';
import { loadAllChecklistState } from './storage';
import {
  detectMilestones,
  localMilestoneStore,
  MilestoneEvent,
  MilestoneInputs,
} from './milestones';
import { StudentProfile, MatchResult } from './types';
import checklistsData from '../../data/checklists.json';

/**
 * Detects new milestones whenever profile, match results, favorites, applying,
 * or checklist progress change. Returns:
 *   - allEvents: every persisted event, newest last
 *   - newBatches: queue of milestone batches awaiting display; every event
 *     detected in the same pass stays together as one batch, so the caller
 *     can render them as a single grouped toast instead of one at a time
 *   - consumeOldestBatch: caller calls this once the oldest batch has been
 *     shown, so the next one (if any) can take its turn
 */
export function useMilestones() {
  const { profile, matchResults, readinessScore, onboardingComplete } = useApp();
  const { favorites } = useFavorites();
  const { applying } = useApplying();

  // Refs hold previous snapshot of each tracked field so we can diff.
  // null on first render — detection skips diff-based events until we have a baseline.
  const prevProfileRef = useRef<StudentProfile | null>(null);
  const prevMatchResultsRef = useRef<MatchResult[] | null>(null);
  const prevReadinessRef = useRef<number | null>(null);
  const prevOnboardingRef = useRef<boolean | null>(null);
  const prevChecklistRef = useRef<Record<string, Record<string, boolean>> | null>(null);

  const [allEvents, setAllEvents] = useState<MilestoneEvent[]>(() => localMilestoneStore.list());
  // Events are queued in BATCHES rather than a flat list — every milestone
  // detected in a single pass (e.g. several schools moving up a category
  // from one profile edit) stays grouped together, so the toast can show
  // them as one combined notification instead of a strung-out sequence.
  const [newBatches, setNewBatches] = useState<MilestoneEvent[][]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Build current checklist progress (read from storage every check — cheap)
    const checklistProgress = loadAllChecklistState();
    const checklistsObj = checklistsData as unknown as Record<string, { tasks: { id: string }[] }>;
    const totalTasksByUnitid: Record<string, number> = {};
    for (const [unitid, c] of Object.entries(checklistsObj)) {
      totalTasksByUnitid[unitid] = (c.tasks ?? []).length;
    }

    const inputs: MilestoneInputs = {
      profile,
      prevProfile: prevProfileRef.current,
      matchResults,
      prevMatchResults: prevMatchResultsRef.current,
      readinessScore,
      prevReadinessScore: prevReadinessRef.current,
      favorites,
      applying,
      checklistProgress,
      prevChecklistProgress: prevChecklistRef.current,
      onboardingComplete,
      prevOnboardingComplete: prevOnboardingRef.current,
      totalTasksByUnitid,
    };

    const fresh = detectMilestones(inputs, localMilestoneStore);
    if (fresh.length > 0) {
      setAllEvents(localMilestoneStore.list());
      setNewBatches(prev => [...prev, fresh]);
    }

    // Update refs for next diff
    prevProfileRef.current = profile;
    prevMatchResultsRef.current = matchResults;
    prevReadinessRef.current = readinessScore;
    prevOnboardingRef.current = onboardingComplete;
    prevChecklistRef.current = checklistProgress;
  }, [profile, matchResults, readinessScore, favorites, applying, onboardingComplete]);

  // Call once the currently-visible batch has finished showing; dequeues it
  // so the next batch (if any) takes its turn.
  const consumeOldestBatch = () => {
    setNewBatches(prev => prev.slice(1));
  };

  return { allEvents, newBatches, consumeOldestBatch };
}
