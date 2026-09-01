-- Geo beacon hits. One row per real pageview (the beacon is loaded by page JS,
-- so bots that don't execute scripts never appear). request.cf fields are free
-- on all Cloudflare plans; client fields come from the beacon.js params.
CREATE TABLE IF NOT EXISTS hits (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        INTEGER NOT NULL,            -- epoch ms
  site      TEXT NOT NULL DEFAULT '',    -- "starrupture", "simpletile", "bestsudoku"…
  path      TEXT NOT NULL DEFAULT '',
  referrer  TEXT NOT NULL DEFAULT '',    -- external referrer host (bot-free), '' = direct/internal
  refpath   TEXT NOT NULL DEFAULT '',    -- referrer path, first 2 segments only (e.g. "/r/sudoku"); no query/slug
  -- geography (request.cf)
  country   TEXT NOT NULL DEFAULT '',    -- ISO code
  region    TEXT NOT NULL DEFAULT '',    -- US state etc.
  city      TEXT NOT NULL DEFAULT '',
  postal    TEXT NOT NULL DEFAULT '',    -- ZIP / postal code (finer US geo)
  continent TEXT NOT NULL DEFAULT '',
  timezone  TEXT NOT NULL DEFAULT '',    -- e.g. "America/New_York"
  lat       TEXT NOT NULL DEFAULT '',
  lon       TEXT NOT NULL DEFAULT '',
  colo      TEXT NOT NULL DEFAULT '',    -- serving Cloudflare PoP
  org       TEXT NOT NULL DEFAULT '',    -- asOrganization (ISP / network)
  -- client / device
  device    TEXT NOT NULL DEFAULT '',    -- desktop | mobile | tablet
  browser   TEXT NOT NULL DEFAULT '',    -- Chrome | Safari | Firefox | Edge | Opera | Other
  os        TEXT NOT NULL DEFAULT '',    -- Windows | macOS | iOS | Android | Linux | Other
  lang      TEXT NOT NULL DEFAULT '',    -- navigator.language (e.g. "en-US")
  screenw   INTEGER NOT NULL DEFAULT 0,  -- viewport width (responsive insight)
  visitor   TEXT NOT NULL DEFAULT 'new', -- 'new' | 'returning' (first-party localStorage; 'returning' is a reserved word)
  -- campaign tags — utm_* from the landing URL query, so tagged links (a subreddit post,
  -- a paid ad) are attributed even when the referrer is stripped. /b allowlist-validates
  -- each one to [A-Za-z0-9_-] and <=40 chars, else stores ''; these three named params are
  -- the ONLY query values ever recorded.
  source    TEXT NOT NULL DEFAULT '',    -- utm_source   (e.g. "google", "reddit")
  medium    TEXT NOT NULL DEFAULT '',    -- utm_medium   (e.g. "cpc", "organic")
  campaign  TEXT NOT NULL DEFAULT '',    -- utm_campaign (e.g. "beta_v2_tier1en", "r_sudoku")
  -- Which FUNNEL the tags above came from. Its own column rather than a reserved `medium`
  -- value: medium carries real campaign data (cpc, organic), so overloading it would either
  -- destroy that data or leave the two funnels indistinguishable.
  --   ''        untagged hit
  --   'web'     utm_* read from a landing URL — a click that arrived at a page
  --   'install' Play install referrer, read once at first launch — a click that arrived at
  --             the Play listing, installed, and opened the app later (possibly days)
  -- Derived by /b when not declared, so senders that already post tags need no change.
  attribution      TEXT NOT NULL DEFAULT '',
  -- Seconds between the ad click and the install beginning (Play install referrer only);
  -- 0 = unknown, which is every non-install hit. Deliberately a DURATION and not the two
  -- absolute timestamps Play returns: the gap is the part that distinguishes an ad-driven
  -- install from an organic one that merely coincided, while two second-resolution moments
  -- alongside city + ISP would narrow the anonymity set far more than a campaign label does.
  click_to_install INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_hits_ts ON hits (ts);
CREATE INDEX IF NOT EXISTS idx_hits_site_ts ON hits (site, ts);

-- Owner opt-out by connection. /mute inserts the caller's IP; /b skips any hit
-- from a listed IP (covers every site, incl. other domains the cookie can't reach).
-- Only the exact IP is excluded — a neighbour on the same ISP has a different IP.
CREATE TABLE IF NOT EXISTS excluded_ips (
  ip   TEXT PRIMARY KEY,           -- CF-Connecting-IP captured at /mute time
  note TEXT NOT NULL DEFAULT '',   -- human hint: "Fuquay Varina, NC · Ting Fiber"
  ts   INTEGER NOT NULL DEFAULT 0  -- when it was added (epoch ms)
);
