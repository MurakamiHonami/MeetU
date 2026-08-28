-- MeetU D1 Schema

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    display_name TEXT NOT NULL,
    picture_url TEXT,
    rating_avg REAL NOT NULL DEFAULT 0.0,
    rating_count INTEGER NOT NULL DEFAULT 0,
    report_count INTEGER NOT NULL DEFAULT 0,
    trade_count INTEGER NOT NULL DEFAULT 0,
    favorite_tags TEXT NOT NULL DEFAULT '[]',   -- JSON string[]
    favorite_labels TEXT NOT NULL DEFAULT '{}', -- JSON {tagId: displayName}
    home_lat REAL,
    home_lon REAL,
    home_name TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'GIVE', 'WANT', 'COMPANION'
    title TEXT NOT NULL,
    note TEXT,
    min_match_count INTEGER NOT NULL DEFAULT 2,
    required_tags TEXT NOT NULL DEFAULT '[]', -- JSON String
    dates TEXT NOT NULL DEFAULT '[]', -- JSON String
    lat REAL,
    lon REAL,
    location_name TEXT,
    geohash TEXT, -- 近傍検索用（6桁）
    status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'CLOSED', 'MATCHED'
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_cards_owner ON cards(owner_id);
CREATE INDEX IF NOT EXISTS idx_cards_status_created ON cards(status, created_at);
CREATE INDEX IF NOT EXISTS idx_cards_geohash ON cards(geohash);

CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY, -- normalized id
    display_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    use_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS card_tags (
    card_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    card_type TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    PRIMARY KEY (card_id, tag_id),
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id)
);

CREATE INDEX IF NOT EXISTS idx_card_tags_tag ON card_tags(tag_id, card_type);

-- タグの共起回数（おすすめの意味拡張に使う）。a < b の順で1行に正規化する。
CREATE TABLE IF NOT EXISTS tag_cooccurrences (
    tag_a TEXT NOT NULL,
    tag_b TEXT NOT NULL,
    hits INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (tag_a, tag_b)
);

CREATE INDEX IF NOT EXISTS idx_cooc_tag_a ON tag_cooccurrences(tag_a, hits);
CREATE INDEX IF NOT EXISTS idx_cooc_tag_b ON tag_cooccurrences(tag_b, hits);

CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    card_a_id TEXT NOT NULL,
    card_b_id TEXT NOT NULL,
    user_a_id TEXT NOT NULL,
    user_b_id TEXT NOT NULL,
    matched_tags TEXT NOT NULL, -- JSON String (tagId)
    matched_labels TEXT NOT NULL DEFAULT '[]', -- JSON String (displayName)
    match_count INTEGER NOT NULL,
    distance_km REAL,
    accepted_a INTEGER NOT NULL DEFAULT 0,
    accepted_b INTEGER NOT NULL DEFAULT 0,
    last_message_at TEXT,
    last_message_by TEXT,
    last_message_preview TEXT,
    last_notified_at INTEGER,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'ACCEPTED', 'DECLINED', 'COMPLETED'
    created_at TEXT NOT NULL,
    FOREIGN KEY (card_a_id) REFERENCES cards(id),
    FOREIGN KEY (card_b_id) REFERENCES cards(id)
);

CREATE INDEX IF NOT EXISTS idx_matches_user_a ON matches(user_a_id);
CREATE INDEX IF NOT EXISTS idx_matches_user_b ON matches(user_b_id);

-- ユーザーごとのマッチ既読時刻（相手には見せない）
CREATE TABLE IF NOT EXISTS match_reads (
    match_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    last_read_at TEXT,
    PRIMARY KEY (match_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    thread_type TEXT NOT NULL DEFAULT 'MATCH', -- 'MATCH' or 'GROUP'
    thread_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'text', -- 'text' | 'image' | 'location'
    text TEXT,
    image_key TEXT,
    lat REAL,
    lon REAL,
    location_name TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_type, thread_id, created_at);

CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    match_id TEXT NOT NULL,
    from_user_id TEXT NOT NULL,
    to_user_id TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (match_id, from_user_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_to_user ON reviews(to_user_id, created_at);

CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    reporter_id TEXT NOT NULL,
    target_user_id TEXT NOT NULL,
    match_id TEXT,
    reason TEXT NOT NULL,
    detail TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_user_id);

-- スワイプ結果（フィードで二度出さないための記録）
CREATE TABLE IF NOT EXISTS swipes (
    user_id TEXT NOT NULL,
    card_id TEXT NOT NULL,
    action TEXT NOT NULL, -- 'save' | 'skip'
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_swipes_user_action ON swipes(user_id, action);

-- 環状交換（3〜4人での持ち回り交換）のグループ
CREATE TABLE IF NOT EXISTS trade_groups (
    id TEXT PRIMARY KEY,
    length INTEGER NOT NULL,
    steps TEXT NOT NULL,          -- JSON: [{fromUserId,toUserId,giveCardId,wantCardId,matchedTags,matchedLabels,matchCount}]
    members TEXT NOT NULL,        -- JSON string[]
    responses TEXT NOT NULL DEFAULT '{}', -- JSON {userId: 'accept'|'decline'}
    found_by TEXT,
    last_message_at TEXT,
    last_message_by TEXT,
    last_message_preview TEXT,
    last_notified_at INTEGER,
    status TEXT NOT NULL DEFAULT 'NEW', -- 'NEW','ACCEPTED','DECLINED','COMPLETED'
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
