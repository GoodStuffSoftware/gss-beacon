# gss-beacon

Public geo beacon for Good Stuff Software analytics. A real browser loads the page
script, which pings this endpoint; the Function reads the visitor's geography from
`request.cf` (free on all Cloudflare plans) and logs one row to **D1**. Consumed by
the private [gss-stats](../gss-stats) dashboard's "Geo beacon" dataset.

**Bot-free by construction** — only browsers that execute page JS hit the beacon, the
same property that makes Cloudflare RUM clean. No cookies; no PII transmitted (only
coarse Cloudflare-provided geography: country, region/state, city, lat/lon).

## Architecture

```
site page  ──<img>──►  beacon.goodstuff.software/b?site=…&path=…
                         └─ Function reads request.cf.{country,region,city,latitude,longitude,colo}
                            └─ INSERT into D1 (gss-geo)
gss-stats /api/geo  ──reads the SAME D1 by binding──►  charts region/city/etc.
```

- **D1 `gss-geo`** (`fa0b2929-0086-479e-ae10-50509c34ebf8`) is bound to *both* this
  project (write) and gss-stats (read) by database id — a runtime binding, no API token.
  (Cloudflare's Analytics Engine SQL API is gated on this plan; D1 sidesteps it.)
- Endpoint returns a 1×1 gif so it works as an `<img>` beacon (no CORS).

## Instrument a site

Add **one line** (the `data-site` tags the source):

```html
<script src="https://beacon.goodstuff.software/beacon.js" data-site="starrupture" defer></script>
```

For native apps (e.g. bestsudoku.app), call the endpoint directly on app open:
`GET https://beacon.goodstuff.software/b?site=bestsudoku&path=/<screen>` (handled separately).

## Deploy

```powershell
$env:CLOUDFLARE_API_TOKEN = (Get-Content "C:\Users\msant\dev\cf-token.txt" -Raw).Trim()
npm run schema   # apply schema.sql to remote D1 (first time / on change)
npm run deploy   # wrangler pages deploy → beacon.goodstuff.software
```

`schema.sql` is the D1 table. `local-seed.sql`-style seeding for local dev lives in gss-stats.
