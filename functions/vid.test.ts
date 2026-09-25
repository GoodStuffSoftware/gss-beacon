// Tests for the per-install visitor id (`vid`) in b.ts. Run with:
//   npm test            (node --test functions/*.test.ts)
//
// No test framework dependency: Node's built-in `node:test` + `node:assert`, and a fake D1
// that records every prepared statement, so the real onRequestGet handler runs end to end.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { visitorId, onRequestGet } from './b.ts'

const VALID = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b'
const CHROME_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36'

interface Call {
  sql: string
  args: unknown[]
}

/** A fake D1 binding. `failWhen(sql)` returning true makes that statement throw, the way
 *  D1 does for "no such column" before a migration. */
function fakeDb(failWhen: (sql: string) => boolean = () => false) {
  const calls: Call[] = []
  const attempts: Call[] = []
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              attempts.push({ sql, args })
              if (failWhen(sql)) throw new Error('D1_ERROR: no such column: vid')
              calls.push({ sql, args })
              return { success: true }
            },
          }
        },
      }
    },
  }
  return { db, calls, attempts }
}

async function hit(query: string, db: unknown, ua = CHROME_UA) {
  const request = new Request(`https://beacon.goodstuff.software/b?${query}`, {
    headers: { 'user-agent': ua, 'CF-Connecting-IP': '203.0.113.7' },
  })
  const res: Response = await (onRequestGet as any)({ request, env: { gss_geo: db } })
  return res
}

/** The value bound to the `vid` column of a recorded INSERT, or undefined if the INSERT
 *  had no vid column at all. */
function boundVid(call: Call): unknown {
  const cols = call.sql.slice(call.sql.indexOf('(') + 1, call.sql.indexOf(')')).split(',').map((c) => c.trim())
  const i = cols.indexOf('vid')
  return i === -1 ? undefined : call.args[i]
}

// ── visitorId (pure) ───────────────────────────────────────────────────────────

test('visitorId accepts a lowercase v4 UUID as-is', () => {
  assert.equal(visitorId(VALID), VALID)
  const fresh = crypto.randomUUID()
  assert.equal(visitorId(fresh), fresh)
})

test('visitorId lowercases, so one device never splits into two join keys', () => {
  assert.equal(visitorId(VALID.toUpperCase()), VALID)
})

test('visitorId returns null for absent or anything that is not exactly a v4 UUID', () => {
  const bad = [
    null,
    '',
    '6f1c2a3b-4d5e-1f60-8a7b-9c0d1e2f3a4b', // v1
    '6f1c2a3b-4d5e-4f60-7a7b-9c0d1e2f3a4b', // bad variant
    VALID.slice(1),
    `${VALID}0`,
    ` ${VALID}`,
    `{${VALID}}`,
    'player@example.com',
    "x' OR 1=1 --",
    'x'.repeat(10_000),
    '6f1c2a3b4d5e4f608a7b9c0d1e2f3a4b0000', // 36 chars, no hyphens
  ]
  for (const v of bad) assert.equal(visitorId(v), null, `should reject ${JSON.stringify(v)?.slice(0, 40)}`)
})

// ── onRequestGet (end to end through the handler) ─────────────────────────────

test('a valid vid is stored in the vid column', async () => {
  const { db, calls } = fakeDb()
  const res = await hit(`site=bestsudoku-web&path=%2Fgame&nv=1&vid=${VALID}`, db)
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('content-type'), 'image/gif')
  assert.equal(calls.length, 1)
  assert.equal(boundVid(calls[0]), VALID)
})

test('an uppercase valid vid is stored lowercased', async () => {
  const { db, calls } = fakeDb()
  await hit(`site=bestsudoku-web&path=%2Fgame&vid=${VALID.toUpperCase()}`, db)
  assert.equal(boundVid(calls[0]), VALID)
})

test('an invalid vid stores NULL and the hit is still recorded', async () => {
  const { db, calls } = fakeDb()
  const res = await hit(`site=bestsudoku-web&path=%2Fgame&vid=${encodeURIComponent('player@example.com')}`, db)
  assert.equal(res.status, 200)
  assert.equal(calls.length, 1)
  assert.equal(boundVid(calls[0]), null)
})

test('an absent vid stores NULL (every other site is unaffected)', async () => {
  const { db, calls } = fakeDb()
  const res = await hit('site=starrupture&path=%2F&nv=0', db)
  assert.equal(res.status, 200)
  assert.equal(calls.length, 1)
  assert.equal(boundVid(calls[0]), null)
  // Everything else about the row is exactly the pre-vid shape: same base columns, same
  // campaign tier, just one more trailing NULL.
  assert.match(calls[0].sql, /INSERT INTO hits \(ts, site, path, referrer, .*refpath, source, medium, campaign, vid\)/)
  assert.equal(calls[0].args[1], 'starrupture')
})

test('before the migration (no vid column) the hit falls back and is still recorded, without vid', async () => {
  const { db, calls, attempts } = fakeDb((sql) => /\bvid\b/.test(sql))
  const res = await hit(`site=bestsudoku-web&path=%2Fgame&vid=${VALID}`, db)
  assert.equal(res.status, 200)
  assert.equal(attempts.length, 2, 'one failed vid attempt, then the campaign tier')
  assert.equal(calls.length, 1)
  assert.equal(boundVid(calls[0]), undefined)
  assert.match(calls[0].sql, /source, medium, campaign\)/)
})

test('a vid can never cause a rejected hit: even if every insert fails, /b still answers the gif', async () => {
  const { db, calls, attempts } = fakeDb(() => true)
  const res = await hit(`site=bestsudoku-web&path=%2Fgame&vid=${VALID}`, db)
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('content-type'), 'image/gif')
  assert.equal(calls.length, 0)
  assert.equal(attempts.length, 3)
})

test('the muted-IP guard still applies to a vid-bearing insert (ip is the last bind)', async () => {
  const { db, calls } = fakeDb()
  await hit(`site=bestsudoku-web&path=%2Fgame&vid=${VALID}`, db)
  assert.match(calls[0].sql, /WHERE NOT EXISTS \(SELECT 1 FROM excluded_ips WHERE ip = \?\)/)
  assert.equal(calls[0].args.at(-1), '203.0.113.7')
})
