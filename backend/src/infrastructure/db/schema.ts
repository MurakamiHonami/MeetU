import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    salt: text("salt").notNull(),
    xId: text("x_id").unique(),
    displayName: text("display_name").notNull(),
    pictureUrl: text("picture_url"),
    ratingAvg: real("rating_avg").notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    reportCount: integer("report_count").notNull().default(0),
    tradeCount: integer("trade_count").notNull().default(0),
    favoriteTags: text("favorite_tags").notNull().default("[]"),
    favoriteLabels: text("favorite_labels").notNull().default("{}"),
    homeLat: real("home_lat"),
    homeLon: real("home_lon"),
    homeName: text("home_name"),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("idx_users_email").on(t.email)],
);

export const cards = sqliteTable(
  "cards",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    type: text("type").notNull(),
    title: text("title").notNull(),
    note: text("note"),
    minMatchCount: integer("min_match_count").notNull().default(2),
    requiredTags: text("required_tags").notNull().default("[]"),
    dates: text("dates").notNull().default("[]"),
    lat: real("lat"),
    lon: real("lon"),
    locationName: text("location_name"),
    geohash: text("geohash"),
    status: text("status").notNull().default("OPEN"),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
  },
  (t) => [
    index("idx_cards_owner").on(t.ownerId),
    index("idx_cards_status_created").on(t.status, t.createdAt),
    index("idx_cards_geohash").on(t.geohash),
  ],
);

export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  category: text("category").notNull().default("other"),
  useCount: integer("use_count").notNull().default(0),
});

export const cardTags = sqliteTable(
  "card_tags",
  {
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id),
    ownerId: text("owner_id").notNull(),
    cardType: text("card_type").notNull(),
    displayName: text("display_name").notNull().default(""),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.cardId, t.tagId], name: "card_tags_pk" }),
    index("idx_card_tags_tag").on(t.tagId, t.cardType),
  ],
);

export const tagCooccurrences = sqliteTable(
  "tag_cooccurrences",
  {
    tagA: text("tag_a").notNull(),
    tagB: text("tag_b").notNull(),
    hits: integer("hits").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.tagA, t.tagB], name: "tag_cooccurrences_pk" }),
    index("idx_cooc_tag_a").on(t.tagA, t.hits),
    index("idx_cooc_tag_b").on(t.tagB, t.hits),
  ],
);

export const matches = sqliteTable(
  "matches",
  {
    id: text("id").primaryKey(),
    cardAId: text("card_a_id")
      .notNull()
      .references(() => cards.id),
    cardBId: text("card_b_id")
      .notNull()
      .references(() => cards.id),
    userAId: text("user_a_id").notNull(),
    userBId: text("user_b_id").notNull(),
    matchedTags: text("matched_tags").notNull(),
    matchedLabels: text("matched_labels").notNull().default("[]"),
    matchCount: integer("match_count").notNull(),
    distanceKm: real("distance_km"),
    acceptedA: integer("accepted_a").notNull().default(0),
    acceptedB: integer("accepted_b").notNull().default(0),
    lastMessageAt: text("last_message_at"),
    lastMessageBy: text("last_message_by"),
    lastMessagePreview: text("last_message_preview"),
    lastNotifiedAt: integer("last_notified_at"),
    status: text("status").notNull().default("PENDING"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_matches_user_a").on(t.userAId), index("idx_matches_user_b").on(t.userBId)],
);

export const matchReads = sqliteTable(
  "match_reads",
  {
    matchId: text("match_id").notNull(),
    userId: text("user_id").notNull(),
    lastReadAt: text("last_read_at"),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.userId], name: "match_reads_pk" })],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    threadType: text("thread_type").notNull().default("MATCH"),
    threadId: text("thread_id").notNull(),
    senderId: text("sender_id").notNull(),
    kind: text("kind").notNull().default("text"),
    text: text("text"),
    imageKey: text("image_key"),
    lat: real("lat"),
    lon: real("lon"),
    locationName: text("location_name"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_messages_thread").on(t.threadType, t.threadId, t.createdAt)],
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    matchId: text("match_id").notNull(),
    fromUserId: text("from_user_id").notNull(),
    toUserId: text("to_user_id").notNull(),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    unique("reviews_match_from_unique").on(t.matchId, t.fromUserId),
    index("idx_reviews_to_user").on(t.toUserId, t.createdAt),
  ],
);

export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    reporterId: text("reporter_id").notNull(),
    targetUserId: text("target_user_id").notNull(),
    matchId: text("match_id"),
    reason: text("reason").notNull(),
    detail: text("detail"),
    status: text("status").notNull().default("PENDING"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_reports_target").on(t.targetUserId)],
);

export const swipes = sqliteTable(
  "swipes",
  {
    userId: text("user_id").notNull(),
    cardId: text("card_id").notNull(),
    action: text("action").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.cardId], name: "swipes_pk" }),
    index("idx_swipes_user_action").on(t.userId, t.action),
  ],
);

export const tradeGroups = sqliteTable("trade_groups", {
  id: text("id").primaryKey(),
  length: integer("length").notNull(),
  steps: text("steps").notNull(),
  members: text("members").notNull(),
  responses: text("responses").notNull().default("{}"),
  foundBy: text("found_by"),
  lastMessageAt: text("last_message_at"),
  lastMessageBy: text("last_message_by"),
  lastMessagePreview: text("last_message_preview"),
  lastNotifiedAt: integer("last_notified_at"),
  status: text("status").notNull().default("NEW"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export const tradeGroupMembers = sqliteTable(
  "trade_group_members",
  {
    groupId: text("group_id").notNull(),
    userId: text("user_id").notNull(),
    lastReadAt: text("last_read_at"),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId], name: "trade_group_members_pk" }),
    index("idx_group_members_user").on(t.userId),
  ],
);

export const schema = {
  users,
  cards,
  tags,
  cardTags,
  tagCooccurrences,
  matches,
  matchReads,
  messages,
  reviews,
  reports,
  swipes,
  tradeGroups,
  tradeGroupMembers,
};
