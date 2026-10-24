import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequestGet } from '../functions/b.ts'
import { SPLIT_REFUSED_PATH_PATTERNS } from '../functions/_lib/refused.ts'

const UA = 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120 Safari/537.36'
const GIF_BYTES = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), (c) => c.charCodeAt(0))

type Step = { changes: number } | 'throw'

interface Harness {
  res: Response
  inserts: number
  boundPaths: unknown[]
  waited: Promise<unknown>[]
}

interface Opts {
  path?: string
  site?: string
  headers?: Record<string, string>
  cf?: Record<string, unknown>
  steps?: Step[]
  live?: unknown // undefined = no LIVE binding
}

// Fake D1: `steps` is one entry per insert attempt (primary, then fallback).
function fakeDb(steps: Step[], h: { inserts: number; boundPaths: unknown[] }) {
  return {
    prepare: () => ({
      bind: (...args: unknown[]) => ({
        run: async () => {
          h.boundPaths.push(args[2]) // the stored (clipped) path is the third bind
          const s = steps[Math.min(h.inserts, steps.length - 1)]
          h.inserts++
          if (s === 'throw') throw new Error('no such column')
          return { success: true, meta: { changes: s.changes } }
        },
      }),
    }),
  }
}

function makeRequest(opts: Opts): Request {
  const url = new URL('https://beacon.goodstuff.software/b')
  url.searchParams.set('site', opts.site ?? 'bsk')
  url.searchParams.set('path', opts.path ?? '/')
  const request = new Request(url, { headers: { 'user-agent': UA, ...(opts.headers ?? {}) } })
  ;(request as any).cf = opts.cf ?? { country: 'US' }
  return request
}

// Runs the handler, then settles every waitUntil promise.
async function run(opts: Opts = {}): Promise<Harness> {
  const h: Harness = { res: undefined as unknown as Response, inserts: 0, boundPaths: [], waited: [] }
  const env: Record<string, unknown> = { gss_geo: fakeDb(opts.steps ?? [{ changes: 1 }], h) }
  if (opts.live !== undefined) env.LIVE = opts.live
  h.res = await (onRequestGet as any)({
    request: makeRequest(opts),
    env,
    waitUntil: (p: Promise<unknown>) => void h.waited.push(p),
  })
  await Promise.all(h.waited)
  return h
}

async function withSpy(opts: Opts = {}) {
  const calls: unknown[][] = []
  const live = {
    notify: (...args: unknown[]) => {
      calls.push(args)
      return Promise.resolve()
    },
  }
  const h = await run({ ...opts, live })
  return { h, calls }
}

async function assertPixel(res: Response) {
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('content-type'), 'image/gif')
  assert.deepEqual(new Uint8Array(await res.arrayBuffer()), GIF_BYTES)
}

test('notifies once, with zero arguments, after a row was written', async () => {
  const { h, calls } = await withSpy({ path: '/play' })
  assert.equal(h.inserts, 1)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].length, 0)
  assert.equal(h.waited.length, 1)
  await assertPixel(h.res)
})

test('no notify when the insert wrote nothing (changes 0, e.g. an excluded IP)', async () => {
  const { h, calls } = await withSpy({ steps: [{ changes: 0 }] })
  assert.equal(h.inserts, 1)
  assert.equal(calls.length, 0)
  await assertPixel(h.res)
})

test('no notify when both inserts fail', async () => {
  const { h, calls } = await withSpy({ steps: ['throw', 'throw'] })
  assert.equal(h.inserts, 2)
  assert.equal(calls.length, 0)
  await assertPixel(h.res)
})

test('fallback insert: notifies after a write, not on changes 0, not on a refused path', async () => {
  let r = await withSpy({ steps: ['throw', { changes: 1 }] })
  assert.equal(r.h.inserts, 2)
  assert.equal(r.calls.length, 1)
  assert.equal(r.calls[0].length, 0)
  r = await withSpy({ steps: ['throw', { changes: 0 }] })
  assert.equal(r.calls.length, 0)
  r = await withSpy({ path: '/return/uc/d0', steps: ['throw', { changes: 1 }] })
  assert.equal(r.h.inserts, 2)
  assert.equal(r.calls.length, 0)
})

// One sample path per refused pattern (a `%` pattern gets a suffix; the others are exact).
const sample = (pat: string) => (pat.endsWith('%') ? pat.slice(0, -1) + 'x/d0' : pat)

test('no notify on any refused pattern, with case variants', async () => {
  for (const pat of SPLIT_REFUSED_PATH_PATTERNS) {
    const base = sample(pat)
    const mixed = base.replace(/(^|\/)([a-z])/g, (_m, a, b) => a + b.toUpperCase())
    for (const path of [base, base.toUpperCase(), mixed]) {
      const { h, calls } = await withSpy({ path })
      assert.equal(h.inserts, 1, path) // the row is still written ...
      assert.equal(calls.length, 0, path) // ... but it never pings
      await assertPixel(h.res)
    }
  }
})

test('refusal is judged on the stored 200-char clip', async () => {
  for (const pat of SPLIT_REFUSED_PATH_PATTERNS) {
    // a refused path far longer than 200 chars is clipped, and the clip is still refused
    // (an exact pattern with no `/%` sibling, like /game/first-finish, has no longer refused form: use it as is)
    const hasLongForm = pat.endsWith('%') || SPLIT_REFUSED_PATH_PATTERNS.includes(pat + '/%')
    const long = hasLongForm ? sample(pat) + '/' + 'a'.repeat(400) : sample(pat)
    const { h, calls } = await withSpy({ path: long })
    assert.equal(String(h.boundPaths[0]).length <= 200, true)
    assert.equal(calls.length, 0, pat)
  }
  // an exact pattern with a long tail is a different path, so it notifies
  for (const exact of SPLIT_REFUSED_PATH_PATTERNS.filter((x) => !x.endsWith('%') && !SPLIT_REFUSED_PATH_PATTERNS.includes(x + '/%'))) {
    const { h, calls } = await withSpy({ path: exact + 'x'.repeat(300) })
    assert.equal(h.inserts, 1, exact)
    assert.equal(calls.length, 1, exact)
  }
  // a refused-looking tail BEYOND the clip is not part of the stored path: it notifies
  const beyond = '/x'.padEnd(200, 'x') + '/return/a'
  const { h, calls } = await withSpy({ path: beyond })
  assert.equal(String(h.boundPaths[0]), beyond.slice(0, 200))
  assert.equal(calls.length, 1)
  // near-misses are not refused
  for (const path of ['/tour/skipped', '/game/first-move', '/tour/start', '/return', '/']) {
    assert.equal((await withSpy({ path })).calls.length, 1, path)
  }
})

test('no notify when the stored path contains NUL (SQLite LIKE truncates at NUL), still writes the row', async () => {
  const exact = SPLIT_REFUSED_PATH_PATTERNS.filter((p) => !p.endsWith('%'))
  const prefix = SPLIT_REFUSED_PATH_PATTERNS.filter((p) => p.endsWith('%')).map((p) => p.slice(0, -1) + 'x')
  const paths = [
    ...exact.flatMap((p) => [p + '\u0000x', p + '\u0000/1', p + '\u0000']), // NUL after each exact pattern
    ...prefix.map((p) => p + '\u0000/d0'), // NUL after a prefix pattern
    '/play\u0000', '/play\u0000x', '/a\u0000/return/b', // NUL in an ordinary path
  ]
  for (const path of paths) {
    const { h, calls } = await withSpy({ path })
    assert.equal(h.inserts, 1, JSON.stringify(path)) // the row is still written ...
    assert.equal(calls.length, 0, JSON.stringify(path)) // ... but it never pings
    await assertPixel(h.res)
  }
})

test('no notify for muted, internal, datacenter or non-browser requests (no insert at all)', async () => {
  const cases: Opts[] = [
    { headers: { cookie: 'a=b; gssb_mute=1' } },
    { site: 'stats' },
    { site: 'Beacon' },
    { cf: { asOrganization: 'Google LLC' } },
    { headers: { 'user-agent': 'curl/8' } },
  ]
  for (const c of cases) {
    const { h, calls } = await withSpy(c)
    assert.equal(h.inserts, 0, JSON.stringify(c))
    assert.equal(calls.length, 0, JSON.stringify(c))
    await assertPixel(h.res)
  }
})

test('a throwing notify leaves the 200 pixel unchanged', async () => {
  const h = await run({
    live: {
      notify: () => {
        throw new Error('boom')
      },
    },
  })
  await assertPixel(h.res)
})

test('a rejecting notify leaves the 200 pixel unchanged, with no unhandled rejection', async () => {
  const unhandled: unknown[] = []
  const on = (e: unknown) => unhandled.push(e)
  process.on('unhandledRejection', on)
  const h = await run({ live: { notify: () => Promise.reject(new Error('down')) } })
  await new Promise((r) => setImmediate(r))
  process.off('unhandledRejection', on)
  await assertPixel(h.res)
  assert.equal(unhandled.length, 0)
})

test('a throwing waitUntil leaves the pixel unchanged', async () => {
  const h = { inserts: 0, boundPaths: [] as unknown[] }
  const res = await (onRequestGet as any)({
    request: makeRequest({}),
    env: { gss_geo: fakeDb([{ changes: 1 }], h), LIVE: { notify: async () => {} } },
    waitUntil: () => {
      throw new Error('waitUntil failed')
    },
  })
  await assertPixel(res)
})

test('a notify that never settles does not delay the pixel (never awaited)', async () => {
  const h = { inserts: 0, boundPaths: [] as unknown[] }
  const waited: Promise<unknown>[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  const res = await Promise.race([
    (onRequestGet as any)({
      request: makeRequest({}),
      env: { gss_geo: fakeDb([{ changes: 1 }], h), LIVE: { notify: () => new Promise(() => {}) } },
      waitUntil: (p: Promise<unknown>) => void waited.push(p),
    }),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('response waited on notify')), 2000)
    }),
  ])
  clearTimeout(timer)
  await assertPixel(res as Response)
  assert.equal(waited.length, 1)
})

test('no LIVE binding still works: row written, pixel returned', async () => {
  const h = await run({ path: '/play' })
  assert.equal(h.inserts, 1)
  assert.equal(h.waited.length, 1) // the guarded no-op still resolves cleanly
  await assertPixel(h.res)
})
