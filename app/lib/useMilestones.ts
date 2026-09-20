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
 *   - newEvents: events that just landed this render (for toast)
 *   - clearNewEvents: caller calls this once they've been displayed
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
  const [newEvents, setNewEvents] = useState<MilestoneEvent[]>([]);

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
      setNewEvents(prev => [...prev, ...fresh]);
    }

    // Update refs for next diff
    prevProfileRef.current = profile;
    prevMatchResultsRef.current = matchResults;
    prevReadinessRef.current = readinessScore;
    prevOnboardingRef.current = onboardingComplete;
    prevChecklistRef.current = checklistProgress;
  }, [profile, matchResults, readinessScore, favorites, applying, onboardingComplete]);

  const consumeNewEvent = (id: string) => {
    setNewEvents(prev => prev.filter(e => e.id !== id));
  };

  return { allEvents, newEvents, consumeNewEvent };
}
