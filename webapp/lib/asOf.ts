// ── The one date this app reasons from ────────────────────────────────────────
// Every number here is derived from a dated personnel extract, so "now" is the
// date of that extract, not the date someone opens the page. Two reasons this
// has to be a constant rather than `new Date()`:
//
//  1. Correctness. Measuring time in grade, ETS windows, and board eligibility
//     against today silently ages the whole force as the extract gets older.
//     A soldier does not become board-eligible because the browser tab was left
//     open until January.
//
//  2. Hydration. This is a static export. A module-scope `new Date()` is
//     evaluated once on the build machine and baked into the prerendered HTML,
//     then evaluated again in the browser at load. Across a New Year boundary
//     the two disagree and React reports a hydration mismatch on a page that
//     renders year math — which is most of them.
//
// When a new extract is loaded, change these two values and nothing else.

/** Date the personnel data was extracted. */
export const AS_OF_ISO = '2026-06-01'

/** Planning year every forecast counts forward from. */
export const AS_OF_YEAR = 2026

/** Human-readable form, for banners and printed products. */
export const AS_OF_LABEL = '1 June 2026'

/**
 * A fresh Date for the as-of instant. Returns a new object each call so a
 * caller that mutates it (setDate, setMonth) cannot corrupt everyone else's.
 */
export function asOfDate(): Date {
  return new Date(`${AS_OF_ISO}T00:00:00`)
}

/**
 * How stale the extract is against real wall-clock time. Only ever call this
 * after mount — it is deliberately not used in render paths that prerender.
 */
export function extractAgeMonths(now: Date): number {
  const from = asOfDate()
  return (now.getFullYear() - from.getFullYear()) * 12 + (now.getMonth() - from.getMonth())
}
