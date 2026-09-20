'use client';

import { useState } from 'react';
import { StudentProfile, DEFAULT_PROFILE, US_STATES, AP_COURSES, ACTIVITY_CATEGORIES, APCourse, Activity, MAJOR_OPTIONS } from '../lib/types';
import { useApp } from '../lib/context';
import { GraduationCap } from '../components/ScholaraLogo';
import { track } from '../lib/events';

const STEP_TITLES = [
  'About You',
  'Academics',
  'Courses',
  'Activities',
];

function ProgressBar({ step }: { step: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, padding: '0 24px 24px' }}>
      {[1, 2, 3, 4].map(n => (
        <div
          key={n}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            background: n <= step ? '#2DD4BF' : '#1E302E',
            transition: 'background 0.3s',
          }}
        />
      ))}
    </div>
  );
}

function SliderField({
  label, value, min, max, step = 0.1, onChange, format, note,
}: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; format?: (v: number) => string; note?: string;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 14, color: '#7A9E9B' }}>{label}</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#2DD4BF' }}>
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
      {note && <div style={{ fontSize: 11, color: '#7A9E9B', marginTop: 4 }}>{note}</div>}
    </div>
  );
}

function SelectField({
  label, value, options, onChange,
}: {
  label: string; value: string; options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ fontSize: 14, color: '#7A9E9B', display: 'block', marginBottom: 8 }}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '12px 14px',
          background: '#162220',
          border: '1px solid #1E302E',
          borderRadius: 10,
          color: '#F0FAFA',
          fontSize: 15,
          appearance: 'none',
          WebkitAppearance: 'none',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function TextField({
  label, value, placeholder, onChange,
}: {
  label: string; value: string; placeholder?: string; onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ fontSize: 14, color: '#7A9E9B', display: 'block', marginBottom: 8 }}>{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '12px 14px',
          background: '#162220',
          border: '1px solid #1E302E',
          borderRadius: 10,
          color: '#F0FAFA',
          fontSize: 15,
          outline: 'none',
        }}
      />
    </div>
  );
}

function ToggleField({
  label, value, onChange, note,
}: {
  label: string; value: boolean; onChange: (v: boolean) => void; note?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
      <div>
        <div style={{ fontSize: 14, color: '#7A9E9B' }}>{label}</div>
        {note && <div style={{ fontSize: 11, color: '#4A6560', marginTop: 2 }}>{note}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 50,
          height: 28,
          borderRadius: 14,
          background: value ? '#2DD4BF' : '#1E302E',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          transition: 'background 0.2s',
          flexShrink: 0,
        }}
      >
        <div style={{
          position: 'absolute',
          top: 3,
          left: value ? 25 : 3,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
        }} />
      </button>
    </div>
  );
}

// Shared "Other AP…" free-text input. Used in onboarding + profile.
export function OtherAPInput({
  apCourses, onAdd,
}: {
  apCourses: APCourse[];
  onAdd: (name: string) => void;
}) {
  const [value, setValue] = useState('');
  const submit = () => {
    let v = value.trim().slice(0, 60);
    if (!v) return;
    // Force "AP " prefix so search/algorithm treats it consistently
    if (!/^ap\s/i.test(v)) v = 'AP ' + v;
    // Normalize the prefix to exactly "AP " (uppercase, single space)
    v = v.replace(/^ap\s+/i, 'AP ');
    // Dedupe (case-insensitive)
    if (apCourses.some(c => c.name.toLowerCase() === v.toLowerCase())) {
      setValue('');
      return;
    }
    onAdd(v);
    setValue('');
  };
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        placeholder="Other AP (e.g. AP Precalculus)"
        maxLength={60}
        style={{
          flex: 1,
          padding: '8px 12px',
          background: '#162220',
          border: '1px solid #1E302E',
          borderRadius: 8,
          color: '#F0FAFA',
          fontSize: 12,
          outline: 'none',
        }}
      />
      <button
        onClick={submit}
        disabled={!value.trim()}
        style={{
          padding: '8px 14px',
          background: value.trim() ? '#2DD4BF' : '#1E302E',
          color: value.trim() ? '#0A0F0E' : '#4A6560',
          border: 'none',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          cursor: value.trim() ? 'pointer' : 'not-allowed',
        }}
      >
        + Add
      </button>
    </div>
  );
}

// Shared AP status + score row used by onboarding Step 3 and Profile Courses section.
export function APStatusRow({
  course, updateStatus, updateScore, onRemove,
}: {
  course: APCourse;
  updateStatus: (name: string, status: APCourse['status']) => void;
  updateScore: (name: string, score: number | null) => void;
  onRemove?: (name: string) => void;
}) {
  const statusOptions: { value: APCourse['status']; label: string }[] = [
    { value: 'planned', label: 'Will take' },
    { value: 'in_progress', label: 'Taking' },
    { value: 'completed', label: 'Taken' },
  ];
  return (
    <div style={{
      padding: '10px 0',
      borderBottom: '1px solid #1E302E',
      marginBottom: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: course.status === 'completed' ? 8 : 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: '#F0FAFA', flex: '1 1 100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 100 }}>
          {course.name.replace('AP ', '')}
        </span>
        {onRemove && (
          <button
            onClick={() => onRemove(course.name)}
            title="Remove this AP"
            aria-label="Remove"
            style={{
              width: 22, height: 22,
              borderRadius: 4,
              border: '1px solid #1E302E',
              background: 'transparent',
              color: '#7A9E9B',
              fontSize: 12,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        )}
        <div style={{ display: 'flex', gap: 0, flexShrink: 0 }}>
          {statusOptions.map((opt, i) => {
            const active = course.status === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => updateStatus(course.name, opt.value)}
                style={{
                  padding: '6px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  border: '1px solid #1E302E',
                  borderLeft: i === 0 ? '1px solid #1E302E' : 'none',
                  borderRadius: i === 0 ? '6px 0 0 6px' : i === statusOptions.length - 1 ? '0 6px 6px 0' : 0,
                  background: active ? '#2DD4BF' : '#162220',
                  color: active ? '#0A0F0E' : '#7A9E9B',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
      {course.status === 'completed' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 2 }}>
          <span style={{ fontSize: 11, color: '#7A9E9B' }}>Score:</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {[1, 2, 3, 4, 5, null].map(s => (
              <button
                key={String(s)}
                onClick={() => updateScore(course.name, s)}
                title={s === null ? 'Took it but no score to share' : `Score ${s}`}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: `1px solid ${course.score === s ? '#2DD4BF' : '#1E302E'}`,
                  background: course.score === s ? '#2DD4BF' : '#162220',
                  color: course.score === s ? '#0A0F0E' : '#7A9E9B',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {s === null ? '?' : s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Step 1: Basic Info
function Step1({ profile, onChange }: { profile: StudentProfile; onChange: (p: Partial<StudentProfile>) => void }) {
  return (
    <div className="animate-fade-in">
      <TextField
        label="Your name"
        value={profile.name}
        placeholder="e.g. Alex Chen"
        onChange={v => onChange({ name: v })}
      />
      <TextField
        label="What should we call you?"
        value={profile.nickname}
        placeholder="e.g. Alex (your nickname)"
        onChange={v => onChange({ nickname: v })}
      />
      <SelectField
        label="Current grade"
        value={profile.grade == null ? '' : String(profile.grade)}
        options={[
          { value: '', label: 'Select grade' },
          { value: '9', label: 'Freshman (Grade 9)' },
          { value: '10', label: 'Sophomore (Grade 10)' },
          { value: '11', label: 'Junior (Grade 11)' },
          { value: '12', label: 'Senior (Grade 12)' },
        ]}
        onChange={v => onChange({ grade: v === '' ? null : (parseInt(v) as 9 | 10 | 11 | 12) })}
      />
      <SelectField
        label="Your state"
        value={profile.state}
        options={[{ value: '', label: 'Select state' }, ...US_STATES.map(s => ({ value: s, label: s }))]}
        onChange={v => onChange({ state: v })}
      />
      <TextField
        label="Your high school"
        value={profile.highSchool}
        placeholder="e.g. Lynbrook High School"
        onChange={v => onChange({ highSchool: v })}
      />
      <ToggleField
        label="First generation college student"
        value={profile.firstGen}
        onChange={v => onChange({ firstGen: v })}
        note="Neither parent attended a 4-year college"
      />
      <SelectField
        label="Gender (optional)"
        value={profile.gender}
        options={[
          { value: '', label: 'Select…' },
          { value: 'male', label: 'Male' },
          { value: 'female', label: 'Female' },
          { value: 'nonbinary', label: 'Non-binary' },
          { value: 'other', label: 'Other' },
          { value: 'declined', label: 'Prefer not to say' },
        ]}
        onChange={v => onChange({ gender: v })}
      />
      <SelectField
        label="Intended major"
        value={profile.intendedMajor}
        options={[{ value: '', label: 'Select intended major' }, ...MAJOR_OPTIONS]}
        onChange={v => onChange({ intendedMajor: v })}
      />
    </div>
  );
}

// Step 2: Academics
function Step2({ profile, onChange }: { profile: StudentProfile; onChange: (p: Partial<StudentProfile>) => void }) {
  const [satEnabled, setSatEnabled] = useState(profile.satScore !== null);
  const [actEnabled, setActEnabled] = useState(profile.actScore !== null);

  return (
    <div className="animate-fade-in">
      <SliderField
        label="Unweighted GPA"
        value={profile.gpaUnweighted}
        min={1.0}
        max={4.0}
        step={0.05}
        onChange={v => onChange({ gpaUnweighted: v })}
        format={v => v.toFixed(2)}
        note="Standard 4.0 scale, not including AP/IB weighting"
      />
      <SliderField
        label="Weighted GPA"
        value={profile.gpaWeighted}
        min={1.0}
        max={5.0}
        step={0.05}
        onChange={v => onChange({ gpaWeighted: v })}
        format={v => v.toFixed(2)}
        note="Including AP/IB/Honors extra points"
      />
      <SelectField
        label="Class rank"
        value={profile.classRank}
        options={[
          { value: 'top_10', label: 'Top 10%' },
          { value: 'top_25', label: 'Top 25%' },
          { value: 'top_50', label: 'Top 50%' },
          { value: 'lower_half', label: 'Lower half' },
          { value: 'unknown', label: 'Unknown / Not ranked' },
        ]}
        onChange={v => onChange({ classRank: v as any })}
      />

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
        Enter whichever you have — <strong style={{ color: '#F0FAFA' }}>SAT, ACT, both, or neither</strong>.
        If you have both, the algorithm uses whichever helps you most at each school. You can override this per school in the &ldquo;See the math&rdquo; view.
      </div>

      <div style={{ marginBottom: 20 }}>
        <ToggleField
          label="I have an SAT score"
          value={satEnabled}
          onChange={v => {
            setSatEnabled(v);
            onChange({ satScore: v ? (profile.satScore || 1200) : null });
          }}
        />
        {satEnabled && (
          <SliderField
            label="SAT Score"
            value={profile.satScore || 1200}
            min={400}
            max={1600}
            step={10}
            onChange={v => onChange({ satScore: v })}
            format={v => String(v)}
          />
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        <ToggleField
          label="I have an ACT score"
          value={actEnabled}
          onChange={v => {
            setActEnabled(v);
            onChange({ actScore: v ? (profile.actScore || 26) : null });
          }}
        />
        {actEnabled && (
          <SliderField
            label="ACT Score"
            value={profile.actScore || 26}
            min={1}
            max={36}
            step={1}
            onChange={v => onChange({ actScore: v })}
            format={v => String(v)}
          />
        )}
      </div>
    </div>
  );
}

// Step 3: Courses
function Step3({ profile, onChange }: { profile: StudentProfile; onChange: (p: Partial<StudentProfile>) => void }) {
  const toggleAP = (courseName: string) => {
    const existing = profile.apCourses.find(c => c.name === courseName);
    if (existing) {
      onChange({ apCourses: profile.apCourses.filter(c => c.name !== courseName) });
    } else {
      const newCourse: APCourse = { name: courseName, score: null, status: 'planned' };
      onChange({ apCourses: [...profile.apCourses, newCourse] });
    }
  };

  const updateStatus = (courseName: string, status: APCourse['status']) => {
    onChange({
      apCourses: profile.apCourses.map(c =>
        c.name === courseName
          ? { ...c, status, score: status === 'completed' ? c.score : null }
          : c
      ),
    });
  };

  const updateScore = (courseName: string, score: number | null) => {
    onChange({
      apCourses: profile.apCourses.map(c =>
        c.name === courseName ? { ...c, score, status: 'completed' } : c
      ),
    });
  };

  const selectedNames = new Set(profile.apCourses.map(c => c.name));

  return (
    <div className="animate-fade-in">
      <ToggleField
        label="IB Program"
        value={profile.ibProgram}
        onChange={v => onChange({ ibProgram: v })}
        note="International Baccalaureate diploma program"
      />

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 14, color: '#7A9E9B', marginBottom: 12 }}>
          AP Classes ({profile.apCourses.length} selected)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {AP_COURSES.map(course => {
            const selected = selectedNames.has(course);
            return (
              <button
                key={course}
                onClick={() => toggleAP(course)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: `1px solid ${selected ? '#2DD4BF' : '#1E302E'}`,
                  background: selected ? 'rgba(45,212,191,0.1)' : '#162220',
                  color: selected ? '#2DD4BF' : '#7A9E9B',
                  fontSize: 12,
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {course.replace('AP ', '')}
              </button>
            );
          })}
        </div>
        <OtherAPInput
          apCourses={profile.apCourses}
          onAdd={name => onChange({ apCourses: [...profile.apCourses, { name, score: null, status: 'planned' }] })}
        />
      </div>

      {profile.apCourses.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 14, color: '#7A9E9B', marginBottom: 12 }}>Mark each AP — taken yet?</div>
          {profile.apCourses.map(course => (
            <APStatusRow
              key={course.name}
              course={course}
              updateStatus={updateStatus}
              updateScore={updateScore}
              onRemove={name => onChange({ apCourses: profile.apCourses.filter(c => c.name !== name) })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Step 4: Activities
function Step4({ profile, onChange }: { profile: StudentProfile; onChange: (p: Partial<StudentProfile>) => void }) {
  const [newActivity, setNewActivity] = useState<string>('');

  const addActivity = (category: string) => {
    const activity: Activity = {
      category,
      name: category,
      leadership: false,
      yearsActive: 1,
      hoursPerWeek: 5,
    };
    onChange({ activities: [...profile.activities, activity] });
  };

  const removeActivity = (index: number) => {
    const updated = profile.activities.filter((_, i) => i !== index);
    onChange({ activities: updated });
  };

  const updateActivity = (index: number, updates: Partial<Activity>) => {
    const updated = profile.activities.map((a, i) => i === index ? { ...a, ...updates } : a);
    onChange({ activities: updated });
  };

  const selectedCategories = new Set(profile.activities.map(a => a.category));

  return (
    <div className="animate-fade-in">
      <div style={{ fontSize: 14, color: '#7A9E9B', marginBottom: 12 }}>
        Select your activities ({profile.activities.length} added)
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {ACTIVITY_CATEGORIES.map(cat => {
          const selected = selectedCategories.has(cat);
          return (
            <button
              key={cat}
              onClick={() => selected ? removeActivity(profile.activities.findIndex(a => a.category === cat)) : addActivity(cat)}
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                border: `1px solid ${selected ? '#2DD4BF' : '#1E302E'}`,
                background: selected ? 'rgba(45,212,191,0.08)' : '#162220',
                color: selected ? '#2DD4BF' : '#7A9E9B',
                fontSize: 14,
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>{cat}</span>
              {selected && <span style={{ fontSize: 18 }}>✓</span>}
            </button>
          );
        })}
      </div>

      {profile.activities.length > 0 && (
        <div>
          <div style={{ fontSize: 14, color: '#7A9E9B', marginBottom: 12 }}>Leadership roles</div>
          {profile.activities.map((act, i) => (
            <div key={i} style={{ marginBottom: 14, padding: '12px 14px', background: '#111918', borderRadius: 10, border: '1px solid #1E302E' }}>
              <div style={{ fontSize: 13, color: '#F0FAFA', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {act.category}
              </div>
              <ToggleField
                label="Leadership position"
                value={act.leadership}
                onChange={v => updateActivity(i, { leadership: v })}
              />
            </div>
          ))}
        </div>
      )}

      <SliderField
        label="Total awards / honors"
        value={profile.awardsCount}
        min={0}
        max={20}
        step={1}
        onChange={v => onChange({ awardsCount: v })}
        format={v => String(Math.round(v))}
        note="Include competitions, scholarships, recognition"
      />
    </div>
  );
}

// Splash screen shown before step 1
function SplashScreen({ onStart }: { onStart: () => void }) {
  return (
    <div
      className="animate-fade-in"
      style={{
        minHeight: '100dvh',
        background: '#0A0F0E',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 32px',
        paddingTop: 'max(60px, env(safe-area-inset-top))',
        paddingBottom: 'max(48px, env(safe-area-inset-bottom))',
        textAlign: 'center',
      }}
    >
      {/* Logo mark */}
      <div style={{
        width: 96,
        height: 96,
        borderRadius: 24,
        background: 'rgba(45,212,191,0.08)',
        border: '1px solid rgba(45,212,191,0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 28,
        boxShadow: '0 0 48px rgba(45,212,191,0.12)',
      }}>
        <GraduationCap size={52} />
      </div>

      {/* Wordmark */}
      <div style={{
        fontSize: 40,
        fontWeight: 900,
        background: 'linear-gradient(135deg, #2DD4BF, #0EA5E9)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        letterSpacing: '-0.02em',
        marginBottom: 12,
        lineHeight: 1,
      }}>
        Scholara
      </div>

      {/* Tagline */}
      <div style={{ fontSize: 18, color: '#F0FAFA', fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>
        Big goals. Small steps. Real success.
      </div>
      <div style={{ fontSize: 14, color: '#7A9E9B', marginBottom: 48, lineHeight: 1.5 }}>
        The Strategy Engine for Students
      </div>

      {/* CTA */}
      <button
        onClick={onStart}
        style={{
          width: '100%',
          maxWidth: 320,
          height: 56,
          borderRadius: 16,
          background: 'linear-gradient(135deg, #2DD4BF, #0D9488)',
          border: 'none',
          color: '#0A0F0E',
          fontSize: 17,
          fontWeight: 700,
          cursor: 'pointer',
          letterSpacing: '-0.01em',
          boxShadow: '0 4px 24px rgba(45,212,191,0.3)',
        }}
      >
        Get Started →
      </button>

      {/* Data attribution note */}
      <div style={{ marginTop: 40, fontSize: 11, color: '#4A6560', lineHeight: 1.6, maxWidth: 280 }}>
        Powered by real admissions data from IPEDS, Common Data Set, and Opportunity Insights
      </div>

      {/* Privacy disclosure — closed beta */}
      <div style={{ marginTop: 16, fontSize: 11, color: '#4A6560', lineHeight: 1.6, maxWidth: 340 }}>
        Scholara collects anonymous usage data to improve the app and uses an AI counselor (Google Gemini) for chat. We never collect your name, email, or contact information during the beta. You can opt out of analytics anytime in Profile settings.
      </div>
    </div>
  );
}

export default function OnboardingFlow() {
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [profile, setProfile] = useState<StudentProfile>({ ...DEFAULT_PROFILE });
  const { completeOnboarding } = useApp();

  const handleChange = (updates: Partial<StudentProfile>) => {
    setProfile(prev => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    if (step === 0) {
      track('onboarding_started');
      setStep(1);
      return;
    }
    if (step < 4) {
      track('onboarding_step_completed', { step });
      setStep(s => (s + 1) as 1 | 2 | 3 | 4);
    } else {
      completeOnboarding(profile);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(s => (s - 1) as 1 | 2 | 3 | 4);
    else if (step === 1) setStep(0);
  };

  const stepOk = () => {
    if (step === 1) return profile.name.trim().length > 0;
    return true;
  };

  // Splash screen
  if (step === 0) {
    return <SplashScreen onStart={() => setStep(1)} />;
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0A0F0E',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: '24px 24px 0', paddingTop: 'max(24px, env(safe-area-inset-top))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {step >= 1 && (
              <button
                onClick={handleBack}
                style={{ background: 'none', border: 'none', color: '#7A9E9B', fontSize: 18, cursor: 'pointer', padding: 4 }}
              >
                ←
              </button>
            )}
            <div>
              <div style={{ fontSize: 11, color: '#7A9E9B', textTransform: 'uppercase', letterSpacing: 1 }}>
                Step {step} of 4
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F0FAFA', margin: 0 }}>
                {STEP_TITLES[step - 1]}
              </h1>
            </div>
          </div>
          {/* Scholara logo mark in top-right */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <GraduationCap size={22} />
          </div>
        </div>
      </div>

      <ProgressBar step={step} />

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
        {step === 1 && <Step1 profile={profile} onChange={handleChange} />}
        {step === 2 && <Step2 profile={profile} onChange={handleChange} />}
        {step === 3 && <Step3 profile={profile} onChange={handleChange} />}
        {step === 4 && <Step4 profile={profile} onChange={handleChange} />}
      </div>

      {/* Footer */}
      <div style={{
        padding: '16px 24px',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
        borderTop: '1px solid #1E302E',
        background: '#0A0F0E',
      }}>
        {step === 1 && !stepOk() && (
          <div style={{ fontSize: 12, color: '#7A9E9B', marginBottom: 8, textAlign: 'center' }}>
            Enter your name to continue
          </div>
        )}
        <button
          onClick={handleNext}
          disabled={!stepOk()}
          style={{
            width: '100%',
            height: 52,
            borderRadius: 14,
            background: stepOk() ? 'linear-gradient(135deg, #2DD4BF, #0D9488)' : '#1E302E',
            border: 'none',
            color: stepOk() ? '#0A0F0E' : '#4A6560',
            fontSize: 16,
            fontWeight: 700,
            cursor: stepOk() ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
          }}
        >
          {step < 4 ? 'Continue →' : 'See My Matches'}
        </button>
      </div>
    </div>
  );
}
