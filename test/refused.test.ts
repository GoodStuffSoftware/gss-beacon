// Parity: the refused-path list and matcher must equal the gss-stats ones (src/lib/splitGuard.ts
// SPLIT_REFUSED_PATH_PATTERNS / isSplitRefusedPath). gss-stats pins the SAME literal in
// src/lib/splitGuard.beaconParity.test.ts. Change the list in both repos, or a test fails.
import test from 'node:test'
import assert from 'node:assert/strict'
import { SPLIT_REFUSED_PATH_PATTERNS, isSplitRefusedPath } from '../functions/_lib/refused.ts'

const GSS_STATS_LIST = [
  '/return/%',
  '/game/complete/%',
  '/game/complete-deferred/%',
  '/game/tutorial-complete/%',
  '/game/start/%',
  '/tour/exit-at/%',
  '/tour/exit-at',
  '/tour/skip',
  '/tour/skip/%',
]

test('refused pattern list equals the gss-stats list (parity)', () => {
  assert.deepEqual([...SPLIT_REFUSED_PATH_PATTERNS], GSS_STATS_LIST)
})

test('matcher: prefix patterns need the full segment, exact patterns match exactly, ASCII case-folded', () => {
  for (const p of [
    '/return/x/d0',
    '/RETURN/x',
    '/Game/Complete/1',
    '/game/complete-deferred/a',
    '/game/tutorial-complete/first-run',
    '/game/start/x',
    '/tour/exit-at',
    '/Tour/Exit-At/3',
    '/tour/skip',
    '/TOUR/SKIP',
    '/tour/skip/x',
  ]) {
    assert.equal(isSplitRefusedPath(p), true, p)
  }
  for (const p of [
    '/',
    '/game',
    '/game/first-move',
    '/tour/start',
    '/tour/complete',
    '/tour/skipped',
    '/tour/exit-atx',
    '/returns',
    '/return',
    '/game/completed',
    '/x/return/y',
    '',
  ]) {
    assert.equal(isSplitRefusedPath(p), false, p)
  }
})
