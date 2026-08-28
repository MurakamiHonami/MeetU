-- Production schema patch: align legacy D1 with current application schema

-- users
ALTER TABLE users ADD COLUMN trade_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN favorite_tags TEXT NOT NULL DEFAULT '[]';
ALTER TABLE users ADD COLUMN favorite_labels TEXT NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN home_lat REAL;
ALTER TABLE users ADD COLUMN home_lon REAL;
ALTER TABLE users ADD COLUMN home_name TEXT;

-- cards
ALTER TABLE cards ADD COLUMN lat REAL;
ALTER TABLE cards ADD COLUMN lon REAL;
ALTER TABLE cards ADD COLUMN location_name TEXT;

-- matches
ALTER TABLE matches ADD COLUMN matched_labels TEXT NOT NULL DEFAULT '[]';
ALTER TABLE matches ADD COLUMN distance_km REAL;
ALTER TABLE matches ADD COLUMN accepted_a INTEGER NOT NULL DEFAULT 0;
ALTER TABLE matches ADD COLUMN accepted_b INTEGER NOT NULL DEFAULT 0;
ALTER TABLE matches ADD COLUMN last_message_at TEXT;
ALTER TABLE matches ADD COLUMN last_message_by TEXT;
ALTER TABLE matches ADD COLUMN last_message_preview TEXT;
ALTER TABLE matches ADD COLUMN last_notified_at INTEGER;

-- new tables
CREATE TABLE IF NOT EXISTS match_reads (
    match_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    last_read_at TEXT,
    PRIMARY KEY (match_id, user_id)
);

CREATE TABLE IF NOT EXISTS tag_cooccurrences (
    tag_a TEXT NOT NULL,
    tag_b TEXT NOT NULL,
    hits INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (tag_a, tag_b)
);
CREATE INDEX IF NOT EXISTS idx_cooc_tag_a ON tag_cooccurrences(tag_a, hits);
CREATE INDEX IF NOT EXISTS idx_cooc_tag_b ON tag_cooccurrences(tag_b, hits);

CREATE TABLE IF NOT EXISTS swipes (
    user_id TEXT NOT NULL,
    card_id TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, card_id)
);
CREATE INDEX IF NOT EXISTS idx_swipes_user_action ON swipes(user_id, action);

CREATE TABLE IF NOT EXISTS trade_groups (
    id TEXT PRIMARY KEY,
    length INTEGER NOT NULL,
    steps TEXT NOT NULL,
    members TEXT NOT NULL,
    responses TEXT NOT NULL DEFAULT '{}',
    found_by TEXT,
    last_message_at TEXT,
    last_message_by TEXT,
    last_message_preview TEXT,
    last_notified_at INTEGER,
    status TEXT NOT NULL DEFAULT 'NEW',
    created_at TEXT NOT NULL,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS trade_group_members (
    group_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    last_read_at TEXT,
    PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON trade_group_members(user_id);
