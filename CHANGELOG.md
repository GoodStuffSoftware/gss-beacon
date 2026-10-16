# Changelog

All notable changes to **gss-beacon** are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project aims to follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **Live-update ping.** After `/b` writes a row it now tells the `gss-live` Worker (service
  binding `LIVE`), so open stats dashboards can refresh without a reload. Counts only: rows on
  return, game-start, completion, tutorial-completion, tour-skip, tour-exit, coach-strip shown, dismiss and close, and ask-order A/B (`/ab/ask-order/…`) paths never ping
  (nor does any path containing a NUL byte, which the SQL guard also refuses), and the ping
  carries no row data. It is fire-and-forget and never changes or delays the pixel;
  with no binding the beacon is unchanged. Deploy `gss-live` first (see README Deploy).
- **Campaign tags (`utm_*`).** `beacon.js` now reads `utm_source` / `utm_medium` /
  `utm_campaign` from the landing URL and `/b` stores them (new `source` / `medium` /
  `campaign` columns), so links tagged per source — e.g. one `utm_campaign` per subreddit,
  or one per paid ad — are attributed even when the referrer is stripped. Each tag is
  allowlist-validated (`[A-Za-z0-9_-]`, 40 chars max) and dropped whole if it doesn't
  match, so these three named parameters are the only query values that can ever reach the
  database — an arbitrary query string still never leaves the visitor's device. The insert
  falls back to the base columns if the DB hasn't been migrated yet (see
  `migrate-campaign.sql`), so a pending migration never drops a hit.
- **Referrer path capture.** A new `refpath` field records the first two segments of an
  external referrer's path (e.g. `/r/sudoku`) — never a slug or query string — so you can
  see which subreddit/section drove a visit. `beacon.js` now derives and sends it too, so
  every beacon.js-instrumented site captures it (not just custom integrations).
- **Subreddit capture from the raw referrer.** When no explicit `refpath` is sent, `/b`
  now derives it from a full `document.referrer` URL — so any beacon that forwards the
  real referrer gets subreddit/section attribution with no client-side change.

### Fixed
- **Referrer attribution no longer depends on the URL format.** `/b` extracts the host
  from either a full URL (`https://www.reddit.com/…`) or a bare hostname (`reddit.com`),
  so a sender that passes only the hostname is still attributed instead of dropped.
- **Automated app-testing traffic is no longer counted.** Firebase Test Lab / Play
  pre-launch run the app inside Google data centers and fire the beacon; hits from
  cloud/data-center ISPs (Google, AWS, Azure, …) are now dropped, so only real users
  on carrier/residential networks are logged.

## [0.1.0] — 2026-07-05

First public release — the beacon as currently deployed at
`beacon.goodstuff.software`.

### Added
- **Bot-free geo beacon.** A Cloudflare Pages Function logs one row per real
  pageview — geography read from `request.cf` — to D1, and returns a 1×1 gif so it
  works as a plain `<img>` with no CORS.
- **One-line instrumentation.** A `beacon.js` loader that auto-tags the site from its
  hostname (or an optional `data-site`).
- **Rich per-hit fields.** Region, city, postal, continent, timezone, ISP, referrer,
  device, browser, OS, language, viewport width, and new-vs-returning.
- **Owner opt-out.** `/mute` and `/unmute` exclude a device via a durable
  `.goodstuff.software` cookie and its network via a server-side IP list — so a muted
  device is skipped on every site, including other domains the cookie can't reach.
- **Infra self-exclusion.** The dashboard and beacon hosts are never logged.
