// Chance bands — student-facing display of admission probability.
//
// Why bands instead of exact percentages: a "93%" prediction implies precision
// the algorithm does not have. College admission outcomes are not predictable
// to single-percentage-point accuracy — especially at selective schools. Bands
// communicate the algorithm's actual confidence interval honestly while still
// being informative ("80–90%" = "very strong odds").
//
// Bands are 10-percentage-point buckets, except the top which is open-ended
// at ">90%" since chance is capped at 95% by the algorithm and we don't want
// to suggest predictive accuracy at that ceiling.

/**
 * Returns the band label for a given chance percentage (0-100).
 * Edge cases: 0-9.99 → "0–10%", 10-19.99 → "10–20%", ..., 90+ → ">90%".
 */
export function chanceBand(chancePct: number): string {
  if (chancePct >= 90) return '>90%';
  if (chancePct < 10) return '0–10%';
  const low = Math.floor(chancePct / 10) * 10;
  return `${low}–${low + 10}%`;
}

/**
 * For sorting / dot rendering / mid-band displays. Returns the midpoint
 * of the band. ">90%" maps to 95 (the algorithm's hard cap).
 */
export function chanceBandMidpoint(chancePct: number): number {
  if (chancePct >= 90) return 95;
  if (chancePct < 10) return 5;
  const low = Math.floor(chancePct / 10) * 10;
  return low + 5;
}
