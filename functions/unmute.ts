/// <reference types="@cloudflare/workers-types" />
//
// GET /unmute — reverse /mute for this device: clears the .goodstuff.software
// cookie AND removes this connection's IP from the server-side exclusion list.

interface Env {
  gss_geo: D1Database
}

function page(body: string): Response {
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Counting re-enabled</title>
<style>
  :root{color-scheme:light dark}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#FAFAF7;color:#1A1715;
       font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif}
  .card{max-width:440px;padding:32px 28px;text-align:center}
  .badge{width:56px;height:56px;border-radius:14px;background:#1A1715;color:#fff;display:grid;place-items:center;
         margin:0 auto 18px;font-size:28px;font-weight:700}
  h1{font-size:20px;margin:0 0 8px} p{margin:6px 0;color:#5c554f}
  a{color:#E0722C;font-weight:600;text-decoration:none}
  @media (prefers-color-scheme:dark){body{background:#1A1715;color:#FAFAF7}p{color:#b5ada3}}
</style>
<div class="card">${body}</div>`
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const ip = ctx.request.headers.get('CF-Connecting-IP') ?? ''
  if (ip) {
    try {
      await ctx.env.gss_geo.prepare('DELETE FROM excluded_ips WHERE ip = ?').bind(ip).run()
    } catch {
      /* table missing / delete failed — clearing the cookie below still applies */
    }
  }
  const cookie = 'gssb_mute=; Domain=.goodstuff.software; Path=/; Max-Age=0; Secure; SameSite=None'
  const res = page(
    `<div class="badge">↺</div>
     <h1>Counting re-enabled</h1>
     <p>This device and network will be counted again. Visit <a href="/mute">/mute</a> to opt out.</p>`,
  )
  res.headers.append('Set-Cookie', cookie)
  return res
}
