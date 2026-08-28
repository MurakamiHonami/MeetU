-- Patch: existing production DB may predate geohash column
ALTER TABLE cards ADD COLUMN geohash TEXT;
CREATE INDEX IF NOT EXISTS idx_cards_geohash ON cards(geohash);
