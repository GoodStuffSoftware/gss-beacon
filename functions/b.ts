/// <reference types="@cloudflare/workers-types" />
//
// Geo beacon endpoint. A page's JS pings GET /b?site=…&path=… ; we read the
// visitor's geo from request.cf (free on all plans) and log one row to D1.
// Bot-free by construction: only real browsers that execute the page script hit
// this. Returns a 1×1 gif so it can be used as an <img> beacon (no CORS needed).

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

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url)
  const cf = ((ctx.request as any).cf ?? {}) as Record<string, unknown>
  const ua = ctx.request.headers.get('user-agent') ?? ''

  // Only log requests that look like a real browser (defence in depth — the page
  // script already filters most non-humans).
  if (/Mozilla|AppleWebKit|Gecko|Chrome|Safari|Firefox/i.test(ua)) {
    const device = /Mobile|Android|iPhone|iPod/i.test(ua)
      ? 'mobile'
      : /iPad|Tablet/i.test(ua)
        ? 'tablet'
        : 'desktop'
    try {
      await ctx.env.gss_geo
        .prepare(
          `INSERT INTO hits (ts, site, path, country, region, city, lat, lon, colo, device)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          Date.now(),
          clip(url.searchParams.get('site'), 40),
          clip(url.searchParams.get('path'), 200),
          clip(cf.country, 4),
          clip(cf.region, 60),
          clip(cf.city, 80),
          clip(cf.latitude, 16),
          clip(cf.longitude, 16),
          clip(cf.colo, 8),
          device,
        )
        .run()
    } catch {
      // Never let a logging failure break the beacon.
    }
  }
  return pixel()
}

// Allow fetch()-based beacons too.
export const onRequestOptions: PagesFunction = async () =>
  new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  })
