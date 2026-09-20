// Tone-positive, grade-aware student-facing copy.
// Used for category narratives ("This is currently a Reach for you, but you
// have 3 years to close the gap…") and similar verdict moments.
//
// Design rule: every message must (1) name where they ARE without sugar-coating
// and (2) name the SPECIFIC time and lever they have to move. No "realistic
// expectations" or "low chance" — bleakness kills motivation in 9th-11th graders
// who genuinely can change their trajectory.

type MatchCategory = 'safety' | 'match' | 'reach' | 'far_reach';

/**
 * Returns what to call the student in addressed copy. Prefers the explicit
 * nickname, falls back to the first token of `name`, then `null`.
 */
export function displayName(profile: { nickname?: string; name?: string }): string | null {
  const nick = (profile.nickname ?? '').trim();
  if (nick) return nick;
  const first = (profile.name ?? '').trim().split(/\s+/)[0] ?? '';
  return first || null;
}

type Grade = 9 | 10 | 11 | 12 | null;

function yearsLabel(grade: Grade): string {
  switch (grade) {
    case 9: return '4 full years';
    case 10: return 'almost 3 years';
    case 11: return 'all of junior year plus a strong senior fall';
    case 12: return 'this application cycle';
    default: return 'time';
  }
}

function gradeLabel(grade: Grade): string {
  switch (grade) {
    case 9: return 'freshman';
    case 10: return 'sophomore';
    case 11: return 'junior';
    case 12: return 'senior';
    default: return 'student';
  }
}

function addressed(name: string | null | undefined, body: string): string {
  if (!name) return body;
  return `${name}, ${body.charAt(0).toLowerCase()}${body.slice(1)}`;
}

/**
 * Returns the student-facing narrative for a school's match category.
 * Grade-aware so the time horizon is realistic. Always names a lever the
 * student can pull, even on Far Reach. If `name` is provided (nickname or
 * first name), the body is addressed to them.
 */
export function categoryNarrative(
  category: MatchCategory,
  grade: Grade,
  name?: string | null
): {
  headline: string;   // bolded short tag, e.g. "Far Reach today"
  body: string;       // the encouragement
} {
  const mk = (headline: string, rawBody: string) => ({
    headline,
    body: addressed(name, rawBody),
  });

  switch (category) {
    case 'safety':
      switch (grade) {
        case 9:
        case 10:
          return mk('Solid foundation', `You're already in this school's range — and you have ${yearsLabel(grade)} to build even more on top of that. Strong starting point.`);
        case 11:
          return mk('In great shape', "You're comfortably in this school's range. A reliable anchor for your final list.");
        case 12:
          return mk('In your range', 'Comfortably in your range — a strong choice to lock in on your list.');
        default:
          return mk('In your range', 'Comfortably in your range — a strong addition to your list.');
      }

    case 'match':
      switch (grade) {
        case 9:
        case 10:
          return mk('Well aligned', `Your profile is aligned with admitted students here. Keep the trajectory steady through your ${gradeLabel(grade)} year and this stays well within reach.`);
        case 11:
          return mk('Strong fit', 'Your profile is well-aligned with admitted students. A strong junior year locks this in.');
        case 12:
          return mk('Strong fit', 'Well-aligned with admitted students. Apply with confidence — this is your range.');
        default:
          return mk('Strong fit', 'Your profile is well-aligned with admitted students here.');
      }

    case 'reach':
      switch (grade) {
        case 9:
        case 10:
          return mk('A reach you can grow into', `Currently a stretch for your profile — but as a ${gradeLabel(grade)} you have ${yearsLabel(grade)} to align with this school's typical admit. A focused effort on the gaps below can move this to Match.`);
        case 11:
          return mk('Within striking distance', 'A reach today. A strong junior year and focused application strategy could move this into Match territory by next fall.');
        case 12:
          return mk('A reach worth attempting', 'A real reach — but the gap is closeable with a strong application. Lean into your best essay and recommendations.');
        default:
          return mk('Within striking distance', 'A reach today. Focused work on the gaps below can move this to Match.');
      }

    case 'far_reach':
      switch (grade) {
        case 9:
          return mk('Ambitious target — and you have the runway', "Currently a far reach for your profile. As a freshman, you have all 4 years to close that gap: hold strong grades, build rigor sophomore year onward, and develop a clear story. Many admits here started exactly where you are.");
        case 10:
          return mk('Ambitious target — time is on your side', 'Currently a far reach. As a sophomore you have almost 3 years to kick it into high gear — strong sophomore-spring grades, an ambitious junior-year courseload, and one breakthrough activity can absolutely move this into Reach territory.');
        case 11:
          return mk('Ambitious — closing the gap is the play', "A far reach right now. Junior year matters most for grades, so an exceptional spring semester plus a strong senior fall can change the picture. Pair this target with matches and safeties so you have great choices.");
        case 12:
          return mk('A long shot worth considering', 'Currently a long shot, but worth submitting if you have the application bandwidth. Lead with your strongest essay and balance the list with matches and safeties.');
        default:
          return mk('Ambitious target', 'Currently a far reach. With focused work on the gaps below, this can become a Reach over time.');
      }
  }
}

/**
 * Short version (one short sentence) for compact surfaces like the soft-confirm
 * modal or list-card chip — same tone, less space.
 */
export function categoryShortMessage(category: MatchCategory, grade: Grade): string {
  switch (category) {
    case 'safety': return "Comfortably in your range.";
    case 'match': return "Well-aligned with admitted students.";
    case 'reach': {
      if (grade === 9 || grade === 10) return `A reach you can grow into — you have ${yearsLabel(grade)}.`;
      if (grade === 11) return 'A reach within striking distance with a strong junior year.';
      return 'A reach worth attempting with a strong application.';
    }
    case 'far_reach': {
      if (grade === 9) return 'Ambitious target — 4 years to close the gap. Worth aspiring to.';
      if (grade === 10) return 'Ambitious target — almost 3 years to close the gap.';
      if (grade === 11) return 'Ambitious — a strong junior spring + senior fall can change the picture.';
      if (grade === 12) return 'A long shot, but worth submitting alongside matches and safeties.';
      return 'Ambitious target — focus on the gaps below to close it.';
    }
  }
}
