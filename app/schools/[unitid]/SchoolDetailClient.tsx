'use client';

import { useMemo, useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from '../../lib/context';
import BottomNav from '../../components/BottomNav';
import schoolsData from '../../../data/schools.json';
import checklistsData from '../../../data/checklists.json';
import { School } from '../../lib/types';
import { useFavorites } from '../../lib/useFavorites';
import { useApplying } from '../../lib/useApplying';
import { track } from '../../lib/events';
import { BenchmarksDisplay } from '../../components/Benchmarks';
import { computeBenchmarks } from '../../lib/benchmarks';
import { categoryNarrative, categoryShortMessage, displayName } from '../../lib/encouragement';
import { chanceBand } from '../../lib/chanceBand';

const CHECKLISTS = checklistsData as Record<string, unknown>;

const schools = schoolsData as School[];

const CATEGORY_CONFIG = {
  safety: { label: 'Safety', color: '#4ADE80' },
  match: { label: 'Match', color: '#2DD4BF' },
  reach: { label: 'Reach', color: '#FACC15' },
  far_reach: { label: 'Far Reach', color: '#F87171' },
};

function ComponentBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: '#7A9E9B' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color }}>{value}/100</span>
      </div>
      <div style={{ height: 6, background: '#1E302E', borderRadius: 3, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${value}%`,
            background: `linear-gradient(90deg, ${color}80, ${color})`,
            borderRadius: 3,
            transition: 'width 0.6s ease',
          }}
        />
      </div>
    </div>
  );
}

export default function SchoolDetailClient({ unitid }: { unitid: string }) {
  const { matchResults, profile } = useApp();
  const { isFavorited, toggle, toast } = useFavorites();
  const { isApplying, toggle: toggleApplying } = useApplying();

  // Check both direct unitid keying (UCI, CMU) and the platform-template
  // fallback (policy.checklist_key, set for every school during Stage 0).
  const schoolForChecklist = schools.find(s => s.unitid === unitid);
  const checklistKey = (schoolForChecklist as unknown as { policy?: { checklist_key?: string } } | undefined)?.policy?.checklist_key || unitid;
  const hasChecklist = unitid in CHECKLISTS || checklistKey in CHECKLISTS;
  const applyingToThis = isApplying(unitid);
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);

  const school = useMemo(() => schools.find(s => s.unitid === unitid), [unitid]);
  const result = useMemo(() => matchResults.find(r => r.schoolUnitid === unitid), [matchResults, unitid]);

  // If the user clicks Apply on a far-reach school, surface a soft confirm so
  // they see the data before committing to a 9-school far-reach list.
  const handleApplyClick = () => {
    if (!applyingToThis && result?.matchCategory === 'far_reach') {
      setShowApplyConfirm(true);
    } else {
      toggleApplying(unitid);
    }
  };

  useEffect(() => {
    if (school) {
      track('school_viewed', {
        unitid,
        category: result?.matchCategory,
        match_score_band: result ? Math.floor(result.matchScore / 10) * 10 : null,
      });
    }
  }, [unitid, school?.unitid, result?.matchCategory]);

  if (!school) {
    return (
      <div style={{ minHeight: '100dvh', background: '#0A0F0E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#7A9E9B' }}>School not found</div>
      </div>
    );
  }

  const cat = result ? CATEGORY_CONFIG[result.matchCategory] : { label: '—', color: '#7A9E9B' };
  const color = cat.color;

  const hasDeadlines = school.ed_deadline || school.ea_deadline || school.rd_deadline;

  const faved = isFavorited(unitid);

  return (
    <div style={{ minHeight: '100dvh', background: '#0A0F0E', paddingBottom: 80 }}>
      {/* Toast */}
      {toast && (
        <div style={{
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
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: '20px 20px 0',
        paddingTop: 'max(20px, env(safe-area-inset-top))',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Link href="/schools" style={{ textDecoration: 'none', color: '#7A9E9B', fontSize: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
            ← Back
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
                onClick={handleApplyClick}
                aria-label={applyingToThis ? 'Remove from applying list' : 'Mark as applying'}
                style={{
                  background: applyingToThis ? '#2DD4BF18' : '#111918',
                  border: `1px solid ${applyingToThis ? '#2DD4BF50' : '#1E302E'}`,
                  borderRadius: 10,
                  color: applyingToThis ? '#2DD4BF' : '#3A5452',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  minHeight: 44,
                  padding: '0 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ fontSize: 14 }}>{applyingToThis ? '✓' : '+'}</span>
                {applyingToThis ? "I'm Applying" : "I'm Applying"}
              </button>
            <Link
              href={`/schools/${unitid}/algorithm?whatif=1`}
              aria-label="Open What-If simulator"
              style={{
                background: '#A78BFA15',
                border: '1px solid #A78BFA40',
                borderRadius: 10,
                color: '#A78BFA',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                minHeight: 44,
                padding: '0 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
                textDecoration: 'none',
              }}
            >
              <span style={{ fontSize: 14 }}>✦</span>
              What If
            </Link>
            <button
              onClick={() => toggle(unitid)}
              aria-label={faved ? 'Remove from favorites' : 'Add to favorites'}
              style={{
                background: faved ? '#FACC1510' : '#111918',
                border: `1px solid ${faved ? '#FACC1540' : '#1E302E'}`,
                borderRadius: 10,
                color: faved ? '#FACC15' : '#3A5452',
                fontSize: 20,
                cursor: 'pointer',
                minWidth: 44,
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >
              {faved ? '★' : '☆'}
            </button>
          </div>
        </div>

        {/* School hero */}
        <div style={{
          background: '#111918',
          border: '1px solid #1E302E',
          borderRadius: 16,
          padding: '20px',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: `${color}18`,
              border: `1px solid ${color}30`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              fontWeight: 700,
              color,
            }}>
              {school.short.charAt(0)}
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: '#F0FAFA', margin: '0 0 4px' }}>
                {school.name}
              </h1>
              <div style={{ fontSize: 13, color: '#7A9E9B' }}>
                {school.city}, {school.state}
              </div>
            </div>
          </div>

          {/* Peer benchmarks — outcome data only */}
          {computeBenchmarks(profile, school).length > 0 && (
            <div style={{
              background: '#111918',
              border: '1px solid #1E302E',
              borderRadius: 16,
              padding: '14px 16px',
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 12, color: '#7A9E9B', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                How you compare to admitted students
              </div>
              <BenchmarksDisplay profile={profile} school={school} />
              <div style={{ marginTop: 8, fontSize: 9, color: '#4A6560' }}>
                Source: IPEDS 2024 + school CDS
              </div>
            </div>
          )}

          {/* Quick stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {[
              {
                label: 'Admit Rate',
                value: school.acceptance_rate !== null ? `${(school.acceptance_rate * 100).toFixed(1)}%` : 'N/A',
              },
              {
                label: 'Your Chance',
                value: result ? chanceBand(result.estimatedChance) : '—',
                highlight: true,
              },
              {
                label: 'Category',
                value: cat.label,
              },
            ].map(stat => (
              <div key={stat.label} style={{
                background: '#162220',
                borderRadius: 10,
                padding: '10px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: stat.highlight ? color : '#F0FAFA' }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 10, color: '#7A9E9B', marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        {/* Match Score Breakdown */}
        {result && (
          <div style={{
            background: '#111918',
            border: '1px solid #1E302E',
            borderRadius: 16,
            padding: '16px',
            marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: '#F0FAFA', margin: 0 }}>Profile Breakdown</h2>
              <div style={{ fontSize: 11, color: '#7A9E9B' }}>vs admitted students</div>
            </div>

            <ComponentBar label="GPA & Academics" value={result.components.gpa} color={color} />
            <ComponentBar label="Test Scores" value={result.components.test} color={color} />
            <ComponentBar label="Course Rigor" value={result.components.rigor} color={color} />
            <ComponentBar label="Extracurriculars" value={result.components.ec} color={color} />

            <div style={{
              marginTop: 12,
              padding: '10px 12px',
              background: `${color}10`,
              border: `1px solid ${color}25`,
              borderRadius: 8,
            }}>
              {(() => {
                const n = categoryNarrative(result.matchCategory, profile.grade, displayName(profile));
                return (
                  <div style={{ fontSize: 12, color, lineHeight: 1.55 }}>
                    <strong>{n.headline}.</strong>{' '}{n.body}
                  </div>
                );
              })()}
            </div>

            <Link
              href={`/schools/${unitid}/algorithm`}
              style={{ textDecoration: 'none', display: 'block', marginTop: 14 }}
            >
              <div style={{
                padding: '12px 14px',
                background: '#0A0F0E',
                border: `1px solid ${color}40`,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color }}>View Full Algorithm Breakdown</div>
                  <div style={{ fontSize: 11, color: '#7A9E9B', marginTop: 2 }}>See exactly how your score was calculated</div>
                </div>
                <span style={{ color, fontSize: 16, marginLeft: 8 }}>→</span>
              </div>
            </Link>

            {hasChecklist && applyingToThis && (
              <Link
                href={`/schools/${unitid}/checklist`}
                style={{ textDecoration: 'none', display: 'block', marginTop: 10 }}
              >
                <div style={{
                  padding: '12px 14px',
                  background: '#0A0F0E',
                  border: '1px solid #2DD4BF40',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#2DD4BF' }}>View Application Checklist</div>
                    <div style={{ fontSize: 11, color: '#7A9E9B', marginTop: 2 }}>Step-by-step tasks to complete your application</div>
                  </div>
                  <span style={{ color: '#2DD4BF', fontSize: 16, marginLeft: 8 }}>→</span>
                </div>
              </Link>
            )}
          </div>
        )}

        {/* Test Score Context */}
        {(school.sat_25 || school.act_25) && (
          <div style={{
            background: '#111918',
            border: '1px solid #1E302E',
            borderRadius: 16,
            padding: '16px',
            marginBottom: 16,
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#F0FAFA', margin: '0 0 14px' }}>Score Ranges (Admitted)</h2>

            {school.sat_25 && school.sat_75 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: '#7A9E9B', marginBottom: 6 }}>SAT — middle 50% of admitted students</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, color: '#7A9E9B', width: 36 }}>{school.sat_25}</span>
                  <div style={{ flex: 1, height: 8, background: '#1E302E', borderRadius: 4, position: 'relative' }}>
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      height: '100%',
                      width: '100%',
                      background: `linear-gradient(90deg, #1E302E, ${color}60, #1E302E)`,
                      borderRadius: 4,
                    }} />
                    {profile.satScore && (() => {
                      const inRange = profile.satScore >= school.sat_25 && profile.satScore <= school.sat_75;
                      const below = profile.satScore < school.sat_25;
                      // Position dot within the 25-75 band; clamp + flag if outside
                      const pct = inRange
                        ? ((profile.satScore - school.sat_25) / (school.sat_75 - school.sat_25)) * 100
                        : below ? 0 : 100;
                      const dotColor = inRange ? color : (below ? '#FACC15' : '#4ADE80');
                      return (
                        <div
                          title={inRange
                            ? `Your score (${profile.satScore}) is in the middle 50%`
                            : below
                              ? `Your score (${profile.satScore}) is below the 25th percentile (${school.sat_25})`
                              : `Your score (${profile.satScore}) is above the 75th percentile (${school.sat_75})`}
                          style={{
                            position: 'absolute',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            left: `${pct}%`,
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            background: '#fff',
                            border: `2px solid ${dotColor}`,
                            boxShadow: `0 0 0 2px ${dotColor}40`,
                          }}
                        />
                      );
                    })()}
                  </div>
                  <span style={{ fontSize: 13, color: '#7A9E9B', width: 36, textAlign: 'right' }}>{school.sat_75}</span>
                </div>
                {profile.satScore && (() => {
                  const below = profile.satScore < school.sat_25!;
                  const above = profile.satScore > school.sat_75!;
                  const inRange = !below && !above;
                  const tagColor = inRange ? '#2DD4BF' : (below ? '#FACC15' : '#4ADE80');
                  const placement = inRange ? 'middle 50%' : below ? `below 25th (${school.sat_25})` : `above 75th (${school.sat_75})`;
                  return (
                    <div style={{ fontSize: 11, color: '#7A9E9B', marginTop: 6 }}>
                      Your score: <span style={{ color: tagColor, fontWeight: 600 }}>{profile.satScore}</span>
                      {' · '}
                      <span style={{ color: tagColor }}>{placement}</span>
                    </div>
                  );
                })()}
              </div>
            )}

            {school.act_25 && school.act_75 && (
              <div>
                <div style={{ fontSize: 12, color: '#7A9E9B', marginBottom: 6 }}>ACT — middle 50% of admitted students</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, color: '#7A9E9B', width: 24 }}>{school.act_25}</span>
                  <div style={{ flex: 1, height: 8, background: '#1E302E', borderRadius: 4, position: 'relative' }}>
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      height: '100%',
                      width: '100%',
                      background: `linear-gradient(90deg, #1E302E, ${color}60, #1E302E)`,
                      borderRadius: 4,
                    }} />
                    {profile.actScore && (() => {
                      const inRange = profile.actScore >= school.act_25 && profile.actScore <= school.act_75;
                      const below = profile.actScore < school.act_25;
                      const pct = inRange
                        ? ((profile.actScore - school.act_25) / (school.act_75 - school.act_25)) * 100
                        : below ? 0 : 100;
                      const dotColor = inRange ? color : (below ? '#FACC15' : '#4ADE80');
                      return (
                        <div
                          title={inRange
                            ? `Your score (${profile.actScore}) is in the middle 50%`
                            : below
                              ? `Your score (${profile.actScore}) is below the 25th percentile (${school.act_25})`
                              : `Your score (${profile.actScore}) is above the 75th percentile (${school.act_75})`}
                          style={{
                            position: 'absolute',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            left: `${pct}%`,
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            background: '#fff',
                            border: `2px solid ${dotColor}`,
                            boxShadow: `0 0 0 2px ${dotColor}40`,
                          }}
                        />
                      );
                    })()}
                  </div>
                  <span style={{ fontSize: 13, color: '#7A9E9B', width: 24, textAlign: 'right' }}>{school.act_75}</span>
                </div>
                {profile.actScore && (() => {
                  const below = profile.actScore < school.act_25!;
                  const above = profile.actScore > school.act_75!;
                  const inRange = !below && !above;
                  const tagColor = inRange ? '#2DD4BF' : (below ? '#FACC15' : '#4ADE80');
                  const placement = inRange ? 'middle 50%' : below ? `below 25th (${school.act_25})` : `above 75th (${school.act_75})`;
                  return (
                    <div style={{ fontSize: 11, color: '#7A9E9B', marginTop: 6 }}>
                      Your score: <span style={{ color: tagColor, fontWeight: 600 }}>{profile.actScore}</span>
                      {' · '}
                      <span style={{ color: tagColor }}>{placement}</span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Admissions Factors */}
        <div style={{
          background: '#111918',
          border: '1px solid #1E302E',
          borderRadius: 16,
          padding: '16px',
          marginBottom: 16,
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#F0FAFA', margin: '0 0 14px' }}>Admissions Factors</h2>
          {Object.entries(school.factor_labels).map(([key, label]) => {
            const importanceColors: Record<string, string> = {
              'Very Important': '#4ADE80',
              'Important': '#2DD4BF',
              'Considered': '#FACC15',
              'Not Considered': '#7A9E9B',
            };
            return (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: '#7A9E9B', textTransform: 'capitalize' }}>{key}</span>
                <span style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 5,
                  background: `${importanceColors[label] || '#7A9E9B'}15`,
                  color: importanceColors[label] || '#7A9E9B',
                  fontWeight: 600,
                }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Application Deadlines */}
        {hasDeadlines && (
          <div style={{
            background: '#111918',
            border: '1px solid #1E302E',
            borderRadius: 16,
            padding: '16px',
            marginBottom: 16,
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#F0FAFA', margin: '0 0 14px' }}>Application Submission Deadlines</h2>
            {[
              { label: 'Early Decision', date: school.ed_deadline, color: '#F87171' },
              { label: 'Early Action', date: school.ea_deadline, color: '#FACC15' },
              { label: 'Regular Decision', date: school.rd_deadline, color: '#2DD4BF' },
            ].filter(d => d.date).map(d => (
              <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#7A9E9B' }}>{d.label}</span>
                <span style={{ fontSize: 13, color: d.color, fontWeight: 600 }}>
                  {d.date ? new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Applicant stats */}
        {school.applicants && (
          <div style={{
            background: '#111918',
            border: '1px solid #1E302E',
            borderRadius: 16,
            padding: '16px',
            marginBottom: 16,
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#F0FAFA', margin: '0 0 14px' }}>2023 Applicants</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { label: 'Applied', value: school.applicants?.toLocaleString() },
                { label: 'Admitted', value: school.admitted?.toLocaleString() },
                { label: 'Enrolled', value: school.enrolled?.toLocaleString() },
              ].map(stat => (
                <div key={stat.label} style={{ background: '#162220', borderRadius: 10, padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#F0FAFA' }}>{stat.value || '—'}</div>
                  <div style={{ fontSize: 10, color: '#7A9E9B', marginTop: 2 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav />

      {/* Soft confirm when adding a far-reach school to "Applying" */}
      {showApplyConfirm && (
        <div
          onClick={() => setShowApplyConfirm(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#0F1817',
              border: '1px solid #F8717140',
              borderRadius: 16,
              padding: 20,
              maxWidth: 420,
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
              marginBottom: 'env(safe-area-inset-bottom, 0)',
            }}
          >
            {(() => {
              const n = categoryNarrative('far_reach', profile.grade, displayName(profile));
              return (
                <>
                  <div style={{ fontSize: 13, color: '#FACC15', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Aim high — and balance your list
                  </div>
                  <div style={{ fontSize: 16, color: '#F0FAFA', fontWeight: 600, marginBottom: 6 }}>
                    {n.headline} for {school?.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#7A9E9B', marginBottom: 14, lineHeight: 1.55 }}>
                    {n.body} Take a look at the numbers below before you commit.
                  </div>
                </>
              );
            })()}
            {school && (
              <div style={{
                background: '#111918',
                border: '1px solid #1E302E',
                borderRadius: 10,
                padding: '12px 14px',
                marginBottom: 14,
              }}>
                <BenchmarksDisplay profile={profile} school={school} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowApplyConfirm(false)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: '#162220',
                  border: '1px solid #1E302E',
                  borderRadius: 10,
                  color: '#7A9E9B',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => { toggleApplying(unitid); setShowApplyConfirm(false); }}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: '#2DD4BF',
                  border: '1px solid #2DD4BF',
                  borderRadius: 10,
                  color: '#0A0F0E',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Yes, I'm in
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
