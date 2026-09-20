'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useApp } from '../lib/context';
import BottomNav from '../components/BottomNav';
import { ScholaraWordmark } from '../components/ScholaraLogo';
import { MatchResult } from '../lib/types';
import { useFavorites } from '../lib/useFavorites';
import { useApplying } from '../lib/useApplying';
import { BenchmarksInfoBadge } from '../components/Benchmarks';
import { chanceBand } from '../lib/chanceBand';
import { track } from '../lib/events';

type CategoryFilter = 'all' | 'safety' | 'match' | 'reach' | 'far_reach' | 'favorites' | 'applying';
type TypeFilter = 'all' | 'national' | 'california';
type SortMode = 'chance' | 'name' | 'acceptance';

const CATEGORY_CONFIG = {
  safety: { label: 'Safety', color: '#4ADE80' },
  match: { label: 'Match', color: '#2DD4BF' },
  reach: { label: 'Reach', color: '#FACC15' },
  far_reach: { label: 'Far Reach', color: '#F87171' },
};

function StarButton({
  isFavorited,
  onToggle,
}: {
  isFavorited: boolean;
  onToggle: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onToggle}
      aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '10px',
        minWidth: 44,
        minHeight: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isFavorited ? '#FACC15' : '#3A5452',
        fontSize: 18,
        flexShrink: 0,
        transition: 'color 0.15s',
      }}
    >
      {isFavorited ? '★' : '☆'}
    </button>
  );
}

export default function SchoolsClient() {
  const { schools, matchResults, profile } = useApp();
  const { favorites, toggle, isFavorited, toast, MAX_FAVORITES } = useFavorites();
  const { applying, isApplying } = useApplying();
  const [catFilter, setCatFilter] = useState<CategoryFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('chance');
  const [search, setSearch] = useState('');
  const filterFirstRender = useRef(true);

  // Honor ?filter=<applying|favorites|safety|match|reach|far_reach|all> from URL
  // so jump-off cards on the home page can deep-link into a filtered view.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const f = params.get('filter');
    const valid: CategoryFilter[] = ['all', 'safety', 'match', 'reach', 'far_reach', 'favorites', 'applying'];
    if (f && (valid as string[]).includes(f)) {
      setCatFilter(f as CategoryFilter);
    }
  }, []);

  useEffect(() => {
    if (filterFirstRender.current) {
      filterFirstRender.current = false;
      return;
    }
    track('schools_filtered', {
      category: catFilter,
      type: typeFilter,
      sort: sortMode,
      has_search: search.length > 0,
    });
  }, [catFilter, typeFilter, sortMode, search.length > 0]);

  const resultMap = useMemo(() => {
    const map = new Map<string, MatchResult>();
    matchResults.forEach(r => map.set(r.schoolUnitid, r));
    return map;
  }, [matchResults]);

  const filtered = useMemo(() => {
    return schools
      .filter(s => {
        if (typeFilter !== 'all' && s.type !== typeFilter) return false;
        if (search && !s.name.toLowerCase().includes(search.toLowerCase()) &&
            !s.short.toLowerCase().includes(search.toLowerCase())) return false;
        if (catFilter === 'favorites') {
          if (!favorites.includes(s.unitid)) return false;
        } else if (catFilter === 'applying') {
          if (!applying.includes(s.unitid)) return false;
        } else if (catFilter !== 'all') {
          const result = resultMap.get(s.unitid);
          if (!result || result.matchCategory !== catFilter) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const ra = resultMap.get(a.unitid);
        const rb = resultMap.get(b.unitid);
        if (sortMode === 'chance') {
          return (rb?.estimatedChance || 0) - (ra?.estimatedChance || 0);
        } else if (sortMode === 'name') {
          return a.name.localeCompare(b.name);
        } else {
          return (a.acceptance_rate || 1) - (b.acceptance_rate || 1);
        }
      });
  }, [schools, catFilter, typeFilter, sortMode, search, resultMap, favorites, applying]);

  const counts = useMemo(() => {
    const c = { all: matchResults.length, safety: 0, match: 0, reach: 0, far_reach: 0 };
    matchResults.forEach(r => { c[r.matchCategory]++; });
    return c;
  }, [matchResults]);

  return (
    <div style={{ minHeight: '100dvh', background: '#0A0F0E', paddingBottom: 80 }}>
      {/* Toast notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 'max(16px, env(safe-area-inset-top))',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 200,
            background: '#1E302E',
            border: '1px solid #FACC1550',
            color: '#FACC15',
            borderRadius: 10,
            padding: '10px 16px',
            fontSize: 13,
            maxWidth: 320,
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: '20px 20px 0',
        paddingTop: 'max(20px, env(safe-area-inset-top))',
      }}>
        {/* Scholara wordmark */}
        <div style={{ marginBottom: 16 }}>
          <ScholaraWordmark size={22} />
        </div>
        {/* Title + applying + favorite badges */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#F0FAFA', margin: 0 }}>Schools</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                fontSize: 13,
                color: applying.length > 0 ? '#4ADE80' : '#3A5452',
                fontWeight: 600,
                padding: '4px 10px',
                background: applying.length > 0 ? '#4ADE8010' : '#1E302E',
                border: `1px solid ${applying.length > 0 ? '#4ADE8030' : '#1E302E'}`,
                borderRadius: 20,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onClick={() => setCatFilter(catFilter === 'applying' ? 'all' : 'applying')}
            >
              ✓ {applying.length}
            </div>
            <div
              style={{
                fontSize: 13,
                color: favorites.length > 0 ? '#FACC15' : '#3A5452',
                fontWeight: 600,
                padding: '4px 10px',
                background: favorites.length > 0 ? '#FACC1510' : '#1E302E',
                border: `1px solid ${favorites.length > 0 ? '#FACC1530' : '#1E302E'}`,
                borderRadius: 20,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onClick={() => setCatFilter(catFilter === 'favorites' ? 'all' : 'favorites')}
            >
              ★ {favorites.length}/{MAX_FAVORITES}
            </div>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Search schools..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '11px 14px 11px 38px',
              background: '#111918',
              border: '1px solid #1E302E',
              borderRadius: 10,
              color: '#F0FAFA',
              fontSize: 15,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#7A9E9B', fontSize: 16 }}>
            🔍
          </span>
        </div>

        {/* Category filter chips */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 10 }}>
          {(['all', 'applying', 'safety', 'match', 'reach', 'far_reach', 'favorites'] as CategoryFilter[]).map(cat => {
            const active = catFilter === cat;
            const color = cat === 'all' ? '#2DD4BF'
              : cat === 'favorites' ? '#FACC15'
              : cat === 'applying' ? '#4ADE80'
              : CATEGORY_CONFIG[cat as keyof typeof CATEGORY_CONFIG].color;
            const label = cat === 'all' ? `All (${counts.all})`
              : cat === 'favorites' ? `★ Saved (${favorites.length})`
              : cat === 'applying' ? `✓ Applying (${applying.length})`
              : `${CATEGORY_CONFIG[cat as keyof typeof CATEGORY_CONFIG].label} (${counts[cat as keyof typeof counts]})`;
            return (
              <button
                key={cat}
                onClick={() => setCatFilter(cat)}
                style={{
                  flexShrink: 0,
                  padding: '6px 12px',
                  minHeight: 36,
                  borderRadius: 20,
                  border: `1px solid ${active ? color : '#1E302E'}`,
                  background: active ? `${color}18` : '#111918',
                  color: active ? color : '#7A9E9B',
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Type + Sort filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as TypeFilter)}
            style={{
              flex: 1,
              padding: '8px 10px',
              background: '#111918',
              border: '1px solid #1E302E',
              borderRadius: 8,
              color: '#7A9E9B',
              fontSize: 13,
              appearance: 'none',
            }}
          >
            <option value="all">All Schools</option>
            <option value="national">National</option>
            <option value="california">California</option>
          </select>
          <select
            value={sortMode}
            onChange={e => setSortMode(e.target.value as SortMode)}
            style={{
              flex: 1,
              padding: '8px 10px',
              background: '#111918',
              border: '1px solid #1E302E',
              borderRadius: 8,
              color: '#7A9E9B',
              fontSize: 13,
              appearance: 'none',
            }}
          >
            <option value="chance">Sort: Best Chance</option>
            <option value="name">Sort: Name</option>
            <option value="acceptance">Sort: Selectivity</option>
          </select>
        </div>
      </div>

      {/* Schools list */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(school => {
          const result = resultMap.get(school.unitid);
          if (!result) return null;
          const cat = CATEGORY_CONFIG[result.matchCategory];
          const color = cat.color;
          const faved = isFavorited(school.unitid);
          const isApplyingTo = isApplying(school.unitid);
          const isEDSchool = profile.earlyDecisionSchool === school.unitid;
          const isEASchool = profile.earlyActionSchool === school.unitid;

          return (
            <div
              key={school.unitid}
              style={{
                background: '#111918',
                border: `1px solid ${isApplyingTo ? '#4ADE8055' : faved ? '#FACC1530' : '#1E302E'}`,
                borderRadius: 12,
                padding: '13px 4px 13px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 0,
              }}
            >
              <Link
                href={`/schools/${school.unitid}`}
                style={{ textDecoration: 'none', flex: 1, display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}
              >
                {/* Avatar with optional applying badge */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: `${color}15`,
                    border: `1px solid ${color}30`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 15,
                    fontWeight: 700,
                    color,
                  }}>
                    {school.short.charAt(0)}
                  </div>
                  {isApplyingTo && (
                    <div
                      title="You're applying to this school"
                      style={{
                        position: 'absolute',
                        bottom: -4,
                        right: -4,
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: '#4ADE80',
                        border: '2px solid #0A0F0E',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#0A0F0E',
                        fontSize: 10,
                        fontWeight: 900,
                        lineHeight: 1,
                      }}
                    >
                      ✓
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#F0FAFA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                          {school.name}
                        </div>
                        {isEDSchool && (
                          <span
                            title="Your Early Decision pick (binding)"
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              letterSpacing: 0.3,
                              color: '#F87171',
                              background: '#F8717118',
                              border: '1px solid #F8717140',
                              padding: '1px 5px',
                              borderRadius: 4,
                              flexShrink: 0,
                            }}
                          >
                            ED
                          </span>
                        )}
                        {isEASchool && (
                          <span
                            title="Your Early Action pick (non-binding)"
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              letterSpacing: 0.3,
                              color: '#FACC15',
                              background: '#FACC1518',
                              border: '1px solid #FACC1540',
                              padding: '1px 5px',
                              borderRadius: 4,
                              flexShrink: 0,
                            }}
                          >
                            EA
                          </span>
                        )}
                        <span onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
                          <BenchmarksInfoBadge profile={profile} school={school} anchor="left" />
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#7A9E9B', marginTop: 1 }}>
                        {school.city}, {school.state} · {school.acceptance_rate !== null ? `${(school.acceptance_rate * 100).toFixed(0)}% admit` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color }}>{chanceBand(result.estimatedChance)}</div>
                      <div style={{
                        fontSize: 10,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: `${color}15`,
                        color,
                        marginTop: 2,
                        fontWeight: 600,
                      }}>
                        {cat.label}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>

              {/* Star button */}
              <StarButton
                isFavorited={faved}
                onToggle={(e) => {
                  e.preventDefault();
                  toggle(school.unitid);
                }}
              />
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#7A9E9B', fontSize: 14 }}>
            {catFilter === 'favorites'
              ? 'No favorites yet — tap ☆ on any school to save it.'
              : 'No schools match your filters'}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
