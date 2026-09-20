'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '../lib/context';
import BottomNav from '../components/BottomNav';
import { ScholaraWordmark } from '../components/ScholaraLogo';
import { AP_COURSES, ACTIVITY_CATEGORIES, APCourse, Activity, MAJOR_OPTIONS } from '../lib/types';
import { clearProfile } from '../lib/storage';
import { useAuth, useUser } from '../lib/useAuth';
import { useRouter } from 'next/navigation';
import { useFavorites } from '../lib/useFavorites';
import { useApplying } from '../lib/useApplying';
import { APStatusRow, OtherAPInput } from '../onboarding/OnboardingFlow';
import { localMilestoneStore, renderMilestone } from '../lib/milestones';
import { isOptedOut, setOptedOut, track } from '../lib/events';

type Section = 'basics' | 'academics' | 'courses' | 'activities';

function SectionHeader({ title, isOpen, onToggle }: { title: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        background: '#111918',
        border: '1px solid #1E302E',
        borderRadius: isOpen ? '12px 12px 0 0' : 12,
        color: '#F0FAFA',
        fontSize: 15,
        fontWeight: 600,
        cursor: 'pointer',
        marginBottom: isOpen ? 0 : 10,
      }}
    >
      {title}
      <span style={{ color: '#7A9E9B', fontSize: 18, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
    </button>
  );
}

function SliderField({
  label, value, min, max, step = 0.05, onChange, format, note,
}: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; format?: (v: number) => string; note?: string;
}) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 14, color: '#7A9E9B' }}>{label}</span>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#2DD4BF' }}>
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%' }}
      />
      {note && <div style={{ fontSize: 11, color: '#4A6560', marginTop: 4 }}>{note}</div>}
    </div>
  );
}

function ToggleField({ label, value, onChange, note }: { label: string; value: boolean; onChange: (v: boolean) => void; note?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, color: '#7A9E9B' }}>{label}</span>
        <button
          onClick={() => onChange(!value)}
          style={{
            width: 48, height: 26, borderRadius: 13,
            background: value ? '#2DD4BF' : '#1E302E',
            border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
            flexShrink: 0,
          }}
        >
          <div style={{
            position: 'absolute', top: 2, left: value ? 24 : 2, width: 22, height: 22,
            borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
          }} />
        </button>
      </div>
      {note && (
        <div style={{ fontSize: 11, color: '#4A6560', marginTop: 4, lineHeight: 1.4 }}>{note}</div>
      )}
    </div>
  );
}

export default function ProfileClient() {
  const { profile, updateProfile, isCalculating, schools } = useApp();
  const { favorites } = useFavorites();
  const { applying } = useApplying();
  // Union of favorited + applying schools — the pool you can pick ED/EA/Legacy from.
  const schoolPool = Array.from(new Set([...favorites, ...applying]))
    .map(unitid => schools.find(s => s.unitid === unitid))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .sort((a, b) => a.name.localeCompare(b.name));
  const isFavorite = (unitid: string) => favorites.includes(unitid);
  const isApplying = (unitid: string) => applying.includes(unitid);
  const [openSection, setOpenSection] = useState<Section>('academics');
  const [showReset, setShowReset] = useState(false);
  const [analyticsOpted, setAnalyticsOpted] = useState(true);

  useEffect(() => {
    setAnalyticsOpted(!isOptedOut());
  }, []);

  const handleAnalyticsToggle = (next: boolean) => {
    if (next) {
      setOptedOut(false);
      setAnalyticsOpted(true);
      track('analytics_opt_in');
    } else {
      track('analytics_opt_out');
      setOptedOut(true);
      setAnalyticsOpted(false);
    }
  };

  const toggleSection = useCallback((s: Section) => {
    setOpenSection(prev => prev === s ? prev : s);
  }, []);

  const toggleAP = (courseName: string) => {
    const existing = profile.apCourses.find(c => c.name === courseName);
    if (existing) {
      updateProfile({ apCourses: profile.apCourses.filter(c => c.name !== courseName) });
    } else {
      const newCourse: APCourse = { name: courseName, score: null, status: 'planned' };
      updateProfile({ apCourses: [...profile.apCourses, newCourse] });
    }
  };

  const updateAPStatus = (courseName: string, status: APCourse['status']) => {
    updateProfile({
      apCourses: profile.apCourses.map(c =>
        c.name === courseName
          ? { ...c, status, score: status === 'completed' ? c.score : null }
          : c
      ),
    });
  };

  const updateAPScore = (courseName: string, score: number | null) => {
    updateProfile({
      apCourses: profile.apCourses.map(c =>
        c.name === courseName ? { ...c, score, status: 'completed' } : c
      ),
    });
  };

  const toggleActivity = (category: string) => {
    const existing = profile.activities.find(a => a.category === category);
    if (existing) {
      updateProfile({ activities: profile.activities.filter(a => a.category !== category) });
    } else {
      const act: Activity = { category, name: category, leadership: false, yearsActive: 1, hoursPerWeek: 5 };
      updateProfile({ activities: [...profile.activities, act] });
    }
  };

  return (
    <div style={{ minHeight: '100dvh', background: '#0A0F0E', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{
        padding: '20px 20px 16px',
        paddingTop: 'max(20px, env(safe-area-inset-top))',
      }}>
        <div style={{ marginBottom: 12 }}>
          <ScholaraWordmark size={22} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#F0FAFA', margin: '0 0 4px' }}>Profile</h1>
            <p style={{ margin: 0, fontSize: 14, color: '#7A9E9B' }}>
              {profile.name || 'Your profile'} · Grade {profile.grade ?? '—'}
              {isCalculating && <span style={{ color: '#2DD4BF' }}> · Updating...</span>}
            </p>
          </div>
          <AccountControls />
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        <RecentAchievements schools={schools} />

        {/* Basics */}
        <SectionHeader title="Basic Info" isOpen={openSection === 'basics'} onToggle={() => toggleSection('basics')} />
        {openSection === 'basics' && (
          <div style={{
            background: '#111918',
            border: '1px solid #1E302E',
            borderTop: 'none',
            borderRadius: '0 0 12px 12px',
            padding: '16px',
            marginBottom: 10,
          }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: '#7A9E9B', display: 'block', marginBottom: 8 }}>Name</label>
              <input
                type="text"
                value={profile.name}
                onChange={e => updateProfile({ name: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', background: '#162220', border: '1px solid #1E302E', borderRadius: 8, color: '#F0FAFA', fontSize: 15, outline: 'none' }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: '#7A9E9B', display: 'block', marginBottom: 8 }}>What should we call you?</label>
              <input
                type="text"
                value={profile.nickname}
                placeholder="Nickname"
                onChange={e => updateProfile({ nickname: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', background: '#162220', border: '1px solid #1E302E', borderRadius: 8, color: '#F0FAFA', fontSize: 15, outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, color: '#7A9E9B', display: 'block', marginBottom: 8 }}>Grade</label>
                <select
                  value={profile.grade ?? ''}
                  onChange={e => updateProfile({ grade: e.target.value === '' ? null : (parseInt(e.target.value) as 9 | 10 | 11 | 12) })}
                  style={{ width: '100%', padding: '10px 12px', background: '#162220', border: '1px solid #1E302E', borderRadius: 8, color: '#F0FAFA', fontSize: 14, appearance: 'none' }}
                >
                  <option value="">Select grade</option>
                  {[9, 10, 11, 12].map(g => <option key={g} value={g}>Grade {g}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, color: '#7A9E9B', display: 'block', marginBottom: 8 }}>State</label>
                <select
                  value={profile.state}
                  onChange={e => updateProfile({ state: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: '#162220', border: '1px solid #1E302E', borderRadius: 8, color: '#F0FAFA', fontSize: 14, appearance: 'none' }}
                >
                  <option value="">Select state</option>
                  {['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: '#7A9E9B', display: 'block', marginBottom: 8 }}>High school</label>
              <input
                type="text"
                value={profile.highSchool}
                onChange={e => updateProfile({ highSchool: e.target.value })}
                placeholder="e.g. Lynbrook High School"
                style={{ width: '100%', padding: '10px 12px', background: '#162220', border: '1px solid #1E302E', borderRadius: 8, color: '#F0FAFA', fontSize: 15, outline: 'none' }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: '#7A9E9B', display: 'block', marginBottom: 8 }}>Intended major</label>
              <select
                value={profile.intendedMajor}
                onChange={e => updateProfile({ intendedMajor: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', background: '#162220', border: '1px solid #1E302E', borderRadius: 8, color: '#F0FAFA', fontSize: 14, appearance: 'none' }}
              >
                <option value="">Select intended major</option>
                {MAJOR_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <ToggleField label="First generation student" value={profile.firstGen} onChange={v => updateProfile({ firstGen: v })} />

            <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #1E302E' }}>
              <div style={{ fontSize: 12, color: '#7A9E9B', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Application Strategy</div>

              {schoolPool.length === 0 ? (
                <div style={{ fontSize: 12, color: '#4A6560', fontStyle: 'italic', padding: '4px 0' }}>
                  Star a school or mark one as &ldquo;Applying&rdquo; — your ED/EA/Legacy picks come from that list.
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 13, color: '#F0FAFA', display: 'block', marginBottom: 6 }}>Early Decision (1 school, binding)</label>
                    <select
                      value={profile.earlyDecisionSchool ?? ''}
                      onChange={e => {
                        const v = e.target.value || null;
                        const patch: Partial<typeof profile> = { earlyDecisionSchool: v };
                        // ED and EA can't be the same school
                        if (v && profile.earlyActionSchool === v) patch.earlyActionSchool = null;
                        updateProfile(patch);
                      }}
                      style={{ width: '100%', padding: '10px 12px', background: '#162220', border: '1px solid #1E302E', borderRadius: 8, color: '#F0FAFA', fontSize: 14, appearance: 'none' }}
                    >
                      <option value="">None — RD everywhere</option>
                      {schoolPool.map(s => (
                        <option key={s.unitid} value={s.unitid}>{s.name}</option>
                      ))}
                    </select>
                    <div style={{ fontSize: 11, color: '#4A6560', marginTop: 4, lineHeight: 1.4 }}>
                      Binding. Adds ~12 points to that one school&apos;s match score.
                    </div>
                  </div>

                  <div style={{ marginBottom: 4 }}>
                    <label style={{ fontSize: 13, color: '#F0FAFA', display: 'block', marginBottom: 6 }}>Early Action (1 school, non-binding)</label>
                    <select
                      value={profile.earlyActionSchool ?? ''}
                      onChange={e => {
                        const v = e.target.value || null;
                        const patch: Partial<typeof profile> = { earlyActionSchool: v };
                        if (v && profile.earlyDecisionSchool === v) patch.earlyDecisionSchool = null;
                        updateProfile(patch);
                      }}
                      style={{ width: '100%', padding: '10px 12px', background: '#162220', border: '1px solid #1E302E', borderRadius: 8, color: '#F0FAFA', fontSize: 14, appearance: 'none' }}
                    >
                      <option value="">None</option>
                      {schoolPool
                        .filter(s => s.unitid !== profile.earlyDecisionSchool)
                        .map(s => (
                          <option key={s.unitid} value={s.unitid}>{s.name}</option>
                        ))}
                    </select>
                    <div style={{ fontSize: 11, color: '#4A6560', marginTop: 4, lineHeight: 1.4 }}>
                      Non-binding. Adds ~4 points to that one school&apos;s match score.
                    </div>
                  </div>
                </>
              )}
            </div>

            <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #1E302E' }}>
              <div style={{ fontSize: 12, color: '#7A9E9B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Legacy</div>
              <div style={{ fontSize: 12, color: '#7A9E9B', marginBottom: 10, lineHeight: 1.5 }}>
                Schools where a parent or grandparent attended. Adds ~8 points to your match score at those specific schools.
              </div>
              {schoolPool.length === 0 ? (
                <div style={{ fontSize: 12, color: '#4A6560', fontStyle: 'italic' }}>
                  Star a school or mark one as &ldquo;Applying&rdquo; first — legacy picks come from that list.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {schoolPool.map(school => {
                    const isLegacy = profile.legacySchools.includes(school.unitid);
                    const fav = isFavorite(school.unitid);
                    const app = isApplying(school.unitid);
                    return (
                      <label key={school.unitid} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '6px 0' }}>
                        <input
                          type="checkbox"
                          checked={isLegacy}
                          onChange={e => {
                            const next = e.target.checked
                              ? [...profile.legacySchools, school.unitid]
                              : profile.legacySchools.filter(u => u !== school.unitid);
                            updateProfile({ legacySchools: next });
                          }}
                          style={{ width: 16, height: 16, accentColor: '#2DD4BF', flexShrink: 0 }}
                        />
                        <span style={{ fontSize: 13, color: '#F0FAFA', flex: 1 }}>{school.name}</span>
                        <span style={{ display: 'flex', gap: 4, fontSize: 10, flexShrink: 0 }}>
                          {fav && (
                            <span style={{ color: '#FACC15', padding: '2px 6px', background: '#FACC1515', borderRadius: 4 }} title="Favorite">★ Fav</span>
                          )}
                          {app && (
                            <span style={{ color: '#2DD4BF', padding: '2px 6px', background: '#2DD4BF15', borderRadius: 4 }} title="Applying">✓ Applying</span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Academics */}
        <SectionHeader title="Academics" isOpen={openSection === 'academics'} onToggle={() => toggleSection('academics')} />
        {openSection === 'academics' && (
          <div style={{
            background: '#111918',
            border: '1px solid #1E302E',
            borderTop: 'none',
            borderRadius: '0 0 12px 12px',
            padding: '16px',
            marginBottom: 10,
          }}>
            <SliderField
              label="Unweighted GPA"
              value={profile.gpaUnweighted}
              min={1.0}
              max={4.0}
              step={0.05}
              onChange={v => updateProfile({ gpaUnweighted: Math.round(v * 100) / 100 })}
              format={v => v.toFixed(2)}
              note="4.0 scale"
            />
            <SliderField
              label="Weighted GPA"
              value={profile.gpaWeighted}
              min={1.0}
              max={5.0}
              step={0.05}
              onChange={v => updateProfile({ gpaWeighted: Math.round(v * 100) / 100 })}
              format={v => v.toFixed(2)}
              note="Including AP/IB/Honors"
            />

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: '#7A9E9B', display: 'block', marginBottom: 8 }}>Class Rank</label>
              <select
                value={profile.classRank}
                onChange={e => updateProfile({ classRank: e.target.value as any })}
                style={{ width: '100%', padding: '10px 12px', background: '#162220', border: '1px solid #1E302E', borderRadius: 8, color: '#F0FAFA', fontSize: 14, appearance: 'none' }}
              >
                <option value="top_10">Top 10%</option>
                <option value="top_25">Top 25%</option>
                <option value="top_50">Top 50%</option>
                <option value="lower_half">Lower half</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            <div style={{
              marginBottom: 14,
              padding: '10px 12px',
              background: '#0F1817',
              border: '1px solid #1E302E',
              borderRadius: 8,
              fontSize: 11,
              color: '#7A9E9B',
              lineHeight: 1.5,
            }}>
              Enter whichever you have — <strong style={{ color: '#F0FAFA' }}>SAT, ACT, both, or neither</strong>. Algorithm uses
              whichever helps you most at each school. Override per school under &ldquo;See the math&rdquo;. If you submit neither,
              selective schools apply a penalty.
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 13, color: '#7A9E9B' }}>SAT Score</label>
                <span style={{ fontSize: 15, fontWeight: 700, color: profile.satScore ? '#2DD4BF' : '#7A9E9B' }}>
                  {profile.satScore || 'Not taken'}
                </span>
              </div>
              {profile.satScore ? (
                <>
                  <input
                    type="range"
                    min={400}
                    max={1600}
                    step={10}
                    value={profile.satScore}
                    onChange={e => updateProfile({ satScore: parseInt(e.target.value) })}
                    style={{ width: '100%', marginBottom: 6 }}
                  />
                  <button
                    onClick={() => updateProfile({ satScore: null })}
                    style={{ fontSize: 12, color: '#F87171', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Remove score
                  </button>
                </>
              ) : (
                <button
                  onClick={() => updateProfile({ satScore: 1200 })}
                  style={{ fontSize: 13, color: '#2DD4BF', background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.2)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', width: '100%' }}
                >
                  + Add SAT Score
                </button>
              )}
            </div>

            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 13, color: '#7A9E9B' }}>ACT Score</label>
                <span style={{ fontSize: 15, fontWeight: 700, color: profile.actScore ? '#2DD4BF' : '#7A9E9B' }}>
                  {profile.actScore || 'Not taken'}
                </span>
              </div>
              {profile.actScore ? (
                <>
                  <input
                    type="range"
                    min={1}
                    max={36}
                    step={1}
                    value={profile.actScore}
                    onChange={e => updateProfile({ actScore: parseInt(e.target.value) })}
                    style={{ width: '100%', marginBottom: 6 }}
                  />
                  <button
                    onClick={() => updateProfile({ actScore: null })}
                    style={{ fontSize: 12, color: '#F87171', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Remove score
                  </button>
                </>
              ) : (
                <button
                  onClick={() => updateProfile({ actScore: 26 })}
                  style={{ fontSize: 13, color: '#2DD4BF', background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.2)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', width: '100%' }}
                >
                  + Add ACT Score
                </button>
              )}
            </div>
          </div>
        )}

        {/* Courses */}
        <SectionHeader title={`Courses (${profile.apCourses.length} AP)`} isOpen={openSection === 'courses'} onToggle={() => toggleSection('courses')} />
        {openSection === 'courses' && (
          <div style={{
            background: '#111918',
            border: '1px solid #1E302E',
            borderTop: 'none',
            borderRadius: '0 0 12px 12px',
            padding: '16px',
            marginBottom: 10,
          }}>
            <ToggleField label="IB Program" value={profile.ibProgram} onChange={v => updateProfile({ ibProgram: v })} />
            <div style={{ fontSize: 13, color: '#7A9E9B', marginBottom: 10 }}>AP Classes</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {AP_COURSES.map(course => {
                const selected = profile.apCourses.some(c => c.name === course);
                return (
                  <button
                    key={course}
                    onClick={() => toggleAP(course)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 7,
                      border: `1px solid ${selected ? '#2DD4BF' : '#1E302E'}`,
                      background: selected ? 'rgba(45,212,191,0.1)' : '#162220',
                      color: selected ? '#2DD4BF' : '#7A9E9B',
                      fontSize: 11,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    {course.replace('AP ', '')}
                  </button>
                );
              })}
            </div>
            <OtherAPInput
              apCourses={profile.apCourses}
              onAdd={name => updateProfile({ apCourses: [...profile.apCourses, { name, score: null, status: 'planned' }] })}
            />

            {profile.apCourses.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 13, color: '#7A9E9B', marginBottom: 10 }}>Status &amp; scores</div>
                {profile.apCourses.map(c => (
                  <APStatusRow
                    key={c.name}
                    course={c}
                    updateStatus={updateAPStatus}
                    updateScore={updateAPScore}
                    onRemove={name => updateProfile({ apCourses: profile.apCourses.filter(x => x.name !== name) })}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Activities */}
        <SectionHeader title={`Activities (${profile.activities.length})`} isOpen={openSection === 'activities'} onToggle={() => toggleSection('activities')} />
        {openSection === 'activities' && (
          <div style={{
            background: '#111918',
            border: '1px solid #1E302E',
            borderTop: 'none',
            borderRadius: '0 0 12px 12px',
            padding: '16px',
            marginBottom: 10,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {ACTIVITY_CATEGORIES.map(cat => {
                const selected = profile.activities.some(a => a.category === cat);
                const act = profile.activities.find(a => a.category === cat);
                return (
                  <div key={cat}>
                    <button
                      onClick={() => toggleActivity(cat)}
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: 10,
                        border: `1px solid ${selected ? '#2DD4BF' : '#1E302E'}`,
                        background: selected ? 'rgba(45,212,191,0.06)' : '#162220',
                        color: selected ? '#2DD4BF' : '#7A9E9B',
                        fontSize: 13,
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      {cat}
                      {selected ? '✓' : '+'}
                    </button>
                    {selected && act && (
                      <div style={{ padding: '8px 14px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 12, color: '#7A9E9B' }}>Leadership</span>
                        <button
                          onClick={() => {
                            const updated = profile.activities.map(a => a.category === cat ? { ...a, leadership: !a.leadership } : a);
                            updateProfile({ activities: updated });
                          }}
                          style={{
                            width: 36, height: 20, borderRadius: 10,
                            background: act.leadership ? '#2DD4BF' : '#1E302E',
                            border: 'none', cursor: 'pointer', position: 'relative',
                          }}
                        >
                          <div style={{
                            position: 'absolute', top: 2, left: act.leadership ? 18 : 2,
                            width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                          }} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <SliderField
              label="Awards / Honors"
              value={profile.awardsCount}
              min={0}
              max={20}
              step={1}
              onChange={v => updateProfile({ awardsCount: Math.round(v) })}
              format={v => String(Math.round(v))}
            />
          </div>
        )}

        {/* About / Footer */}
        <div style={{
          marginTop: 24,
          padding: '16px',
          background: '#111918',
          border: '1px solid #1E302E',
          borderRadius: 12,
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2DD4BF', marginBottom: 6 }}>
            Scholara
          </div>
          <div style={{ fontSize: 12, color: '#7A9E9B', lineHeight: 1.6, marginBottom: 8 }}>
            Big goals. Small steps. Real success.
          </div>
          <div style={{ fontSize: 11, color: '#4A6560', lineHeight: 1.6, marginBottom: 12 }}>
            Powered by real admissions data from IPEDS, Common Data Set, and Opportunity Insights
          </div>
          <a
            href="/methodology.html"
            style={{
              display: 'inline-block',
              fontSize: 12,
              fontWeight: 600,
              color: '#2DD4BF',
              textDecoration: 'none',
              padding: '6px 12px',
              border: '1px solid rgba(45,212,191,0.3)',
              borderRadius: 6,
            }}
          >
            How Scholara works &rarr;
          </a>
        </div>

        {/* Privacy / Analytics opt-out */}
        <div style={{
          marginTop: 8,
          marginBottom: 16,
          padding: '14px 16px',
          background: '#111918',
          border: '1px solid #1E302E',
          borderRadius: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#F0FAFA', marginBottom: 4 }}>
                Help improve Scholara
              </div>
              <div style={{ fontSize: 11, color: '#7A9E9B', lineHeight: 1.5 }}>
                Share anonymous usage data so we can make the app better. Never includes your name, email, or contact info.
              </div>
            </div>
            <button
              role="switch"
              aria-checked={analyticsOpted}
              onClick={() => handleAnalyticsToggle(!analyticsOpted)}
              style={{
                width: 44,
                height: 26,
                borderRadius: 999,
                border: 'none',
                background: analyticsOpted ? '#2DD4BF' : '#1E302E',
                position: 'relative',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'background 0.15s',
              }}
            >
              <span style={{
                position: 'absolute',
                top: 3,
                left: analyticsOpted ? 21 : 3,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.15s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>
        </div>

        {/* Reset / Danger zone */}
        <div style={{ marginTop: 8, marginBottom: 20 }}>
          {!showReset ? (
            <button
              onClick={() => setShowReset(true)}
              style={{ color: '#7A9E9B', background: 'none', border: 'none', fontSize: 13, cursor: 'pointer', padding: 0 }}
            >
              Reset profile
            </button>
          ) : (
            <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 14, color: '#F87171', marginBottom: 12 }}>Reset all data?</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => {
                    clearProfile();
                    window.location.reload();
                  }}
                  style={{ flex: 1, padding: '10px', background: '#F87171', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Yes, reset
                </button>
                <button
                  onClick={() => setShowReset(false)}
                  style={{ flex: 1, padding: '10px', background: '#1E302E', border: 'none', borderRadius: 8, color: '#7A9E9B', fontSize: 13, cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

// Shows the last 5 milestone events as a small "achievements" panel near the
// top of Profile. Reads from localMilestoneStore directly (no need for the
// detection hook — that runs at the AppProvider level).
function RecentAchievements({ schools }: { schools: { unitid: string; name: string; short: string }[] }) {
  const all = localMilestoneStore.list();
  if (all.length === 0) return null;
  const recent = all.slice(-5).reverse();
  const schoolNameFor = (unitid: string) =>
    schools.find(s => s.unitid === unitid)?.short
    ?? schools.find(s => s.unitid === unitid)?.name
    ?? null;

  const fmtAgo = (iso: string) => {
    const ms = Date.now() - new Date(iso).getTime();
    const min = Math.round(ms / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const d = Math.round(hr / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div style={{
      background: '#111918',
      border: '1px solid #1E302E',
      borderRadius: 16,
      padding: '14px 16px',
      marginBottom: 16,
    }}>
      <div style={{ fontSize: 12, color: '#7A9E9B', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        Recent achievements
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recent.map(evt => {
          const r = renderMilestone(evt, { schoolNameFor });
          return (
            <div key={evt.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 18, flexShrink: 0, width: 24, textAlign: 'center' }}>{r.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#F0FAFA', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.title}
                </div>
                {r.subtitle && (
                  <div style={{ fontSize: 11, color: '#7A9E9B', marginTop: 1 }}>{r.subtitle}</div>
                )}
              </div>
              <div style={{ fontSize: 10, color: '#4A6560', flexShrink: 0 }}>{fmtAgo(evt.createdAt)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Top-right pill on the Profile page: shows signed-in email (truncated) and
 * a sign-out button. Hidden when auth is not configured (dev/preview).
 */
function AccountControls() {
  const { user, isAuthEnabled } = useUser();
  const { signOut } = useAuth();
  const router = useRouter();
  if (!isAuthEnabled || !user) return null;

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 4,
      flexShrink: 0,
      maxWidth: 140,
    }}>
      <div style={{
        fontSize: 10,
        color: '#7A9E9B',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '100%',
      }}
      title={user.email ?? ''}>
        {user.email ?? 'Signed in'}
      </div>
      <button
        onClick={handleSignOut}
        style={{
          fontSize: 11,
          color: '#F87171',
          background: '#F8717110',
          border: '1px solid #F8717140',
          borderRadius: 6,
          padding: '4px 10px',
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        Sign out
      </button>
    </div>
  );
}
