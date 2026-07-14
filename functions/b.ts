/// <reference types="@cloudflare/workers-types" />
//
// Geo beacon endpoint. A page's JS pings GET /b?site=…&path=…&ref=…&l=…&sw=…&nv=… ;
// we read the visitor's geo/network from request.cf (free on all plans) plus a few
// client signals, and log one row to D1. Bot-free by construction (only real
// browsers that execute the page script hit this). Returns a 1×1 gif.

interface Env {
  gss_geo: D1Database
}

const GIF = Uint8Array.from(
  atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),
  (c) => c.charCodeAt(0),
)
function pixel(): Response {
  return new Response(GIF, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
const clip = (v: unknown, n: number) => String(v ?? '').slice(0, n)

// External referrer host only — drop same-page/internal navigations. Accepts EITHER a
// full URL (https://www.reddit.com/r/x) OR a bare hostname (reddit.com), so a sender
// that passes only the hostname still gets attributed instead of silently dropped.
function refHost(ref: string, pageHost: string): string {
  if (!ref) return ''
  let h = ''
  try {
    h = new URL(ref).hostname
  } catch {
    h = ref.split(/[/?#]/)[0].split(':')[0] // bare hostname fallback
  }
  h = h.toLowerCase().replace(/^www\./, '')
  const page = String(pageHost || '').toLowerCase().replace(/^www\./, '')
  return h && h !== page ? h : ''
}

// First two path segments of a "/a/b/c" path (e.g. a subreddit "/r/sudoku"). Strips any
// query/hash; empty if there's no meaningful path.
function first2Segs(pathish: string): string {
  const segs = (pathish || '').split(/[?#]/)[0].split('/').filter(Boolean).slice(0, 2)
  return segs.length ? '/' + segs.join('/') : ''
}
// Referrer path — which subreddit/section sent the visit. Prefer the explicit refpath
// param; if it's absent, derive it from the ref URL's path (so a beacon that only sends
// the raw document.referrer still yields the subreddit, with no client change needed).
function refPathOf(refParam: string, explicit: string): string {
  const fromExplicit = first2Segs(explicit)
  if (fromExplicit) return fromExplicit
  try {
    return first2Segs(new URL(refParam).pathname) // bare hostnames have no path → ''
  } catch {
    return ''
  }
}
function browserOf(ua: string): string {
  if (/Edg\//i.test(ua)) return 'Edge'
  if (/OPR\/|Opera/i.test(ua)) return 'Opera'
  if (/Firefox\//i.test(ua)) return 'Firefox'
  if (/Chrome\//i.test(ua)) return 'Chrome'
  if (/Safari\//i.test(ua)) return 'Safari'
  return 'Other'
}
function osOf(ua: string): string {
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Android/i.test(ua)) return 'Android'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS'
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS'
  if (/Linux/i.test(ua)) return 'Linux'
  return 'Other'
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url)
  const cf = ((ctx.request as any).cf ?? {}) as Record<string, unknown>
  const ua = ctx.request.headers.get('user-agent') ?? ''
  let pageHost = ''
  try {
    pageHost = new URL(ctx.request.headers.get('referer') ?? '').hostname
  } catch {
    /* no referer */
  }

  const site = clip(url.searchParams.get('site'), 40)
  const internal = /^(stats|beacon)$/i.test(site) // never log the dashboard or beacon infra itself
  // Owner opt-out: /mute set a durable .goodstuff.software cookie on this device;
  // it also recorded this connection's IP in excluded_ips (covers cross-domain
  // sites the cookie can't reach). The insert below skips excluded IPs directly.
  const muted = /(?:^|;\s*)gssb_mute=1(?:;|$)/.test(ctx.request.headers.get('cookie') ?? '')
  const ip = ctx.request.headers.get('CF-Connecting-IP') ?? ''
  // Data-center / cloud traffic is never a real user. On the WEB the beacon is bot-free
  // (bots don't run page JS), but the native app runs inside Google's automated testing
  // (Firebase Test Lab, Play pre-launch) on real devices in Google data centers — those
  // DO fire the beacon. Real users are on a carrier/residential ISP; drop cloud ISPs.
  const org = clip(cf.asOrganization, 80)
  const datacenter =
    /\b(google (llc|cloud)|amazon|aws|microsoft|azure|oracle (cloud|corp)|digitalocean|linode|hetzner|ovh|scaleway|vultr|contabo|gcore|leaseweb|m247)\b/i.test(org)
  if (!internal && !muted && !datacenter && /Mozilla|AppleWebKit|Gecko|Chrome|Safari|Firefox/i.test(ua)) {
    const device = /Mobile|Android|iPhone|iPod/i.test(ua) ? 'mobile' : /iPad|Tablet/i.test(ua) ? 'tablet' : 'desktop'
    const sw = Math.max(0, Math.min(20000, parseInt(url.searchParams.get('sw') ?? '0') || 0))
    // Referrer host + path — e.g. "reddit.com" + "/r/sudoku". Compute the host once; only
    // record a path for an EXTERNAL referrer (same-host refs are dropped by refHost, so no
    // internal path leaks). refPathOf prefers the explicit refpath param, else derives it
    // from a full ref URL — so a beacon that only sends document.referrer still yields it.
    const refParam = url.searchParams.get('ref') ?? ''
    const referrerHost = clip(refHost(refParam, pageHost), 120)
    const refpath = referrerHost ? clip(refPathOf(refParam, url.searchParams.get('refpath') ?? ''), 60) : ''
    try {
      await ctx.env.gss_geo
        .prepare(
          `INSERT INTO hits
            (ts, site, path, referrer, country, region, city, postal, continent, timezone,
             lat, lon, colo, org, device, browser, os, lang, screenw, visitor, refpath)
           SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
           WHERE NOT EXISTS (SELECT 1 FROM excluded_ips WHERE ip = ?)`,
        )
        .bind(
          Date.now(),
          site,
          clip(url.searchParams.get('path'), 200),
          referrerHost,
          clip(cf.country, 4),
          clip(cf.region, 60),
          clip(cf.city, 80),
          clip(cf.postalCode, 16),
          clip(cf.continent, 4),
          clip(cf.timezone, 40),
          clip(cf.latitude, 16),
          clip(cf.longitude, 16),
          clip(cf.colo, 8),
          org,
          device,
          browserOf(ua),
          osOf(ua),
          clip(url.searchParams.get('l'), 12),
          sw,
          url.searchParams.get('nv') === '1' ? 'returning' : 'new',
          refpath,
          ip, // skip the insert entirely if this connection is on the exclusion list
        )
        .run()
    } catch {
      // Never let a logging failure break the beacon.
    }
  }
  return pixel()
}

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  })
