# Changelog

All notable changes to **gss-beacon** are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project aims to follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed
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
