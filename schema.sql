-- Geo beacon hits. One row per real pageview (the beacon is loaded by page JS,
-- so bots that don't execute scripts never appear).
CREATE TABLE IF NOT EXISTS hits (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  ts      INTEGER NOT NULL,            -- epoch ms
  site    TEXT NOT NULL DEFAULT '',    -- e.g. "starrupture", "simpletile", "bestsudoku"
  path    TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',    -- ISO code, from request.cf.country
  region  TEXT NOT NULL DEFAULT '',    -- e.g. "California" (US state), request.cf.region
  city    TEXT NOT NULL DEFAULT '',
  lat     TEXT NOT NULL DEFAULT '',
  lon     TEXT NOT NULL DEFAULT '',
  colo    TEXT NOT NULL DEFAULT '',
  device  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_hits_ts ON hits (ts);
CREATE INDEX IF NOT EXISTS idx_hits_site_ts ON hits (site, ts);
