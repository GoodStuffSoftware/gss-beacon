// Refused-path guard, copied from gss-stats (src/lib/splitGuard.ts:
// SPLIT_REFUSED_PATH_PATTERNS and isSplitRefusedPath). Keep it IDENTICAL: same list, same
// matching. test/refused.test.ts pins the literal list, and gss-stats pins the same literal in
// src/lib/splitGuard.beaconParity.test.ts, so a change on either side fails a test.
//
// Product rule (Mike, 2026-10-03): "counts only. Never tie beacon rows to a device, time or
// place." A row on one of these paths must never trigger or influence a live-update ping, so
// functions/b.ts checks the stored path against this list before it calls the LIVE binding.

/** SQL LIKE patterns for the rows the rule protects (return-curve beacons, game completions,
 * counted game starts, tour skips and exits, tutorial completions, coach-strip dismiss, close and shown rows). A pattern ending in `%` is a
 * prefix match; any other pattern matches that exact path. */
export const SPLIT_REFUSED_PATH_PATTERNS: readonly string[] = [
  '/return/%',
  '/game/complete/%',
  '/game/complete-deferred/%',
  '/game/tutorial-complete/%',
  '/game/start/%',
  '/tour/exit-at/%',
  '/tour/exit-at',
  '/tour/skip',
  '/tour/skip/%',
  '/coach/dismissed/%',
  '/coach/closed-at/%',
  '/coach/shown/%',
]

/** The JS reading of SPLIT_REFUSED_PATH_PATTERNS, matching SQLite LIKE (ASCII case folded; a
 * pattern ending in `%` is a prefix match, any other pattern is an exact match).
 *
 * Fails closed on NUL: SQLite compares LIKE operands as NUL-terminated text, so a stored path such
 * as `/tour/skip\u0000x` LIKE '/tour/skip' is true in gss-stats' SQL guard (refused) while a plain
 * JS comparison says it is not. Any path containing NUL is therefore treated as refused here, so a
 * row the SQL guard refuses can never trigger a ping. The pattern list above is unchanged. */
export function isSplitRefusedPath(path: string): boolean {
  if (path.includes('\u0000')) return true
  const p = path.replace(/[A-Z]/g, (c) => c.toLowerCase())
  return SPLIT_REFUSED_PATH_PATTERNS.some((pat) =>
    pat.endsWith('%') ? p.startsWith(pat.slice(0, -1)) : p === pat,
  )
}
