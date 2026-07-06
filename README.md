# gss-beacon

Bot-free geo/analytics beacon for **Good Stuff Software**. A real browser loads a tiny
script that pings this endpoint; the Cloudflare Pages Function reads the visitor's
geography from `request.cf` (free on all plans) and logs **one row per real pageview**
to D1. Consumed by the [gss-stats](https://github.com/GoodStuffSoftware/gss-stats)
dashboard's "Geo beacon" dataset.

🌐 Live at **https://beacon.goodstuff.software**.

**Bot-free by construction** — only browsers that execute page JS hit the beacon, the
same property that makes Cloudflare RUM clean. No cookies for tracking; only coarse
Cloudflare-provided geography (country, region/state, city, lat/lon) and client hints.

## Instrument a site

Add **one line** (`data-site` is optional — the loader auto-tags from the hostname):

```html
<script src="https://beacon.goodstuff.software/beacon.js" data-site="starrupture" defer></script>
```

For native apps, call the endpoint directly on screen open:
`GET https://beacon.goodstuff.software/b?site=<app>&path=/<screen>`.

## Stack

| Layer | Choice |
|---|---|
| Runtime | Cloudflare Pages Functions (`functions/*.ts`) |
| Store | Cloudflare D1 (`gss-geo`) |
| Loader | `public/beacon.js` (vanilla, ~1 KB) |

## Endpoints

| Route | Purpose |
|---|---|
| `GET /b` | Log one pageview row (returns a 1×1 gif, so it works as an `<img>` — no CORS). |
| `GET /mute` | Exclude **this device** (durable `.goodstuff.software` cookie) and **this network** (server-side IP list). |
| `GET /unmute` | Reverse `/mute` for this device + network. |
| `/beacon.js` | The loader script sites embed. |

## What's logged

Per hit: timestamp, site, path, external referrer host, and from `request.cf` —
country, region, city, postal, continent, timezone, lat/lon, colo, ISP
(`asOrganization`). Plus client hints: device, browser, OS, language, viewport width,
and new-vs-returning (first-party `localStorage`). No IP is stored on the pageview
row; IPs are only kept in a small owner-exclusion list.

## Owner opt-out

Visiting **`/mute`** on a device drops a durable cookie *and* records that
connection's IP server-side, so the device is skipped on every Good Stuff site —
including other domains the cookie can't reach. `/unmute` reverses it. The beacon also
honors `?gssbmute=1` / `?gssbunmute=1` as a per-origin fallback.

## Architecture

```
site page  ──<img>──►  beacon.goodstuff.software/b?site=…&path=…
                         └─ Function reads request.cf.{country,region,city,lat,lon,colo,asOrganization}
                            └─ INSERT into D1 (gss-geo)   (skipped if the caller is muted)
gss-stats /api/geo  ──reads the SAME D1 by binding──►  charts region/city/ISP/map
```

- **D1 `gss-geo`** is bound to *both* this project (write) and gss-stats (read) by
  database id — a runtime binding, no API token. (Cloudflare's Analytics Engine SQL
  API is gated on this plan; D1 sidesteps it.)

## Docs

| Area | Entry point |
|---|---|
| Changelog | [CHANGELOG.md](CHANGELOG.md) |
| Contributing / conventions | [CLAUDE.md](CLAUDE.md) |
| Dashboard (consumer) | [GoodStuffSoftware/gss-stats](https://github.com/GoodStuffSoftware/gss-stats) |

## Deploy

Manual `wrangler` deploy with the token from a local, gitignored file:

```powershell
$env:CLOUDFLARE_API_TOKEN = (Get-Content "<path>\cf-token.txt" -Raw).Trim()
npm run schema   # apply schema.sql to remote D1 (first time / on change)
npm run deploy   # wrangler pages deploy → beacon.goodstuff.software
```

`schema.sql` defines the D1 tables (`hits` + the `excluded_ips` opt-out list).

## Branch

`main` — the deployed line.
