-- One-time migration: add campaign-tag columns to an existing `hits` table.
-- (schema.sql already includes these for fresh databases; SQLite has no
-- "ADD COLUMN IF NOT EXISTS", so run this ONCE against a pre-existing DB.)
--
--   Local:      npx wrangler d1 execute gss-geo --local  --file=./migrate-campaign.sql
--   Production: npx wrangler d1 execute gss-geo --remote --file=./migrate-campaign.sql
--
-- Safe + additive: existing rows get '' for these; the beacon logs hits without
-- them until this runs (its insert falls back), then starts recording them.
ALTER TABLE hits ADD COLUMN source   TEXT NOT NULL DEFAULT '';
ALTER TABLE hits ADD COLUMN medium   TEXT NOT NULL DEFAULT '';
ALTER TABLE hits ADD COLUMN campaign TEXT NOT NULL DEFAULT '';
