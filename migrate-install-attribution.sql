-- One-time migration: add install-attribution columns to an existing `hits` table.
-- (schema.sql already includes these for fresh databases; SQLite has no
-- "ADD COLUMN IF NOT EXISTS", so run this ONCE against a pre-existing DB.)
--
--   Local:      npx wrangler d1 execute gss-geo --local  --file=./migrate-install-attribution.sql
--   Production: npx wrangler d1 execute gss-geo --remote --file=./migrate-install-attribution.sql
--
-- SAFETY on the live table (2772 rows at time of writing):
--   * Both ALTERs are metadata-only. SQLite's ADD COLUMN with a constant DEFAULT does not
--     rewrite existing rows — it records the default and returns it for older rows — so
--     this is O(1) regardless of row count, not a 2772-row rewrite.
--   * Purely additive. No column is dropped, renamed or retyped, and no existing value is
--     read or overwritten by the ALTERs.
--   * /b tolerates this migration being PENDING: its insert tries the richest column set
--     first and degrades, so hits keep landing (minus these two fields) until it runs.
--   * NOT idempotent — running it twice errors with "duplicate column name". That is the
--     same one-shot contract as migrate-campaign.sql.

ALTER TABLE hits ADD COLUMN attribution      TEXT    NOT NULL DEFAULT '';
ALTER TABLE hits ADD COLUMN click_to_install INTEGER NOT NULL DEFAULT 0;

-- BACKFILL — the only statement here that touches existing rows. Every campaign-tagged row
-- that predates this column came from a landing-URL utm read (beacon.js on the web); the
-- Play install path did not exist, so 'web' is not a guess. Without this, historical tagged
-- rows would sit at '' and every "web vs install" comparison would silently under-count the
-- web side. Affects ~132 rows.
--
-- Reverse with:
--   UPDATE hits SET attribution = '' WHERE attribution = 'web';
UPDATE hits
   SET attribution = 'web'
 WHERE attribution = ''
   AND (source <> '' OR medium <> '' OR campaign <> '');
