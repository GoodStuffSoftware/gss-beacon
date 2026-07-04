/// <reference types="@cloudflare/workers-types" />
//
// GET /mute — mark THIS device as the owner's so its pageviews are never logged.
// Sets a durable first-party cookie on .goodstuff.software; the /b beacon reads it
// and skips the D1 write. One visit covers every *.goodstuff.software site on this
// device. (Different registrable domains — goodstuffsoftware.com, bestsudoku.app —
// can't share this cookie; use the ?gssbmute=1 URL there, handled by beacon.js.)

interface Env {
  gss_geo: D1Database
}

const TEN_YEARS = 315_360_000

function page(title: string, body: string): Response {
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  :root{color-scheme:light dark}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#FAFAF7;color:#1A1715;
       font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif}
  .card{max-width:440px;padding:32px 28px;text-align:center}
  .badge{width:56px;height:56px;border-radius:14px;background:#E0722C;color:#fff;display:grid;place-items:center;
         margin:0 auto 18px;font-size:28px;font-weight:700}
  h1{font-size:20px;margin:0 0 8px} p{margin:6px 0;color:#5c554f}
  .who{margin:16px 0;padding:12px;border:1px solid #e7e1d8;border-radius:10px;font-size:14px;color:#1A1715}
  a{color:#E0722C;font-weight:600;text-decoration:none}
  @media (prefers-color-scheme:dark){body{background:#1A1715;color:#FAFAF7}.who{border-color:#3a342e;color:#FAFAF7}p{color:#b5ada3}}
</style>
<div class="card">${body}</div>`
  return html
    ? new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
    : new Response('ok')
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const cf = ((ctx.request as any).cf ?? {}) as Record<string, unknown>
  const ip = ctx.request.headers.get('CF-Connecting-IP') ?? ''
  const where = [cf.city, cf.region, cf.country].filter(Boolean).join(', ') || 'unknown location'
  const net = String(cf.asOrganization ?? 'unknown network')

  // Record THIS connection's IP so every site's beacon skips it — including the
  // sites on other domains the .goodstuff.software cookie can't reach. It's just
  // your exact connection: a neighbour on the same ISP has a different IP and is
  // still counted. (Phones on cellular get a different IP — tap /mute there too.)
  if (ip) {
    try {
      await ctx.env.gss_geo
        .prepare('INSERT OR REPLACE INTO excluded_ips (ip, note, ts) VALUES (?, ?, ?)')
        .bind(ip, `${where} · ${net}`, Date.now())
        .run()
    } catch {
      /* table missing / write failed — the cookie below still covers goodstuff.software */
    }
  }

  const cookie = `gssb_mute=1; Domain=.goodstuff.software; Path=/; Max-Age=${TEN_YEARS}; Secure; SameSite=None`
  const res = page(
    'Device excluded',
    `<div class="badge">✓</div>
     <h1>You're now excluded — everywhere</h1>
     <p>Visits from this device and this network won't be counted on any Good&nbsp;Stuff site.</p>
     <div class="who">This connection: <b>${where}</b><br>${net}</div>
     <p style="font-size:13px">Changed your mind? <a href="/unmute">Re-enable counting</a></p>`,
  )
  res.headers.append('Set-Cookie', cookie)
  return res
}
