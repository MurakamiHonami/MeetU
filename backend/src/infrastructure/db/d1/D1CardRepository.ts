import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { ICardRepository, CardTagHit } from "../../../domain/card/ICardRepository";
import { Card, CardProps, CardType } from "../../../domain/card/Card";
import { Location } from "../../../domain/shared/Location";
import { AppDatabase, parseJson } from "../database";
import { cardTags, cards } from "../schema";

export class D1CardRepository implements ICardRepository {
  constructor(private db: AppDatabase) {}

  private mapRowToCard(
    row: typeof cards.$inferSelect,
    tags: string[],
    tagLabels: Record<string, string>,
  ): Card {
    const props: CardProps = {
      id: row.id,
      ownerId: row.ownerId,
      type: row.type as CardType,
      title: row.title,
      note: row.note ?? undefined,
      minMatchCount: row.minMatchCount,
      tags,
      tagLabels,
      requiredTags: parseJson<string[]>(row.requiredTags, []),
      dates: parseJson<string[]>(row.dates, []),
      location:
        row.lat != null && row.lon != null
          ? { lat: row.lat, lon: row.lon, ...(row.locationName ? { name: row.locationName } : {}) }
          : undefined,
      status: row.status as CardProps["status"],
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    };
    return new Card(props);
  }

  private async loadTags(
    cardId: string,
  ): Promise<{ tags: string[]; tagLabels: Record<string, string> }> {
    const results = await this.db
      .select({ tagId: cardTags.tagId, displayName: cardTags.displayName })
      .from(cardTags)
      .where(eq(cardTags.cardId, cardId))
      .all();
    const tags = results.map((r) => r.tagId);
    const tagLabels: Record<string, string> = {};
    for (const r of results) tagLabels[r.tagId] = r.displayName || r.tagId;
    return { tags, tagLabels };
  }

  private async loadTagsForCards(
    cardIds: string[],
  ): Promise<Map<string, { tags: string[]; tagLabels: Record<string, string> }>> {
    const map = new Map<string, { tags: string[]; tagLabels: Record<string, string> }>();
    if (cardIds.length === 0) return map;
    const results = await this.db
      .select({
        cardId: cardTags.cardId,
        tagId: cardTags.tagId,
        displayName: cardTags.displayName,
      })
      .from(cardTags)
      .where(inArray(cardTags.cardId, cardIds))
      .all();
    for (const r of results) {
      let entry = map.get(r.cardId);
      if (!entry) {
        entry = { tags: [], tagLabels: {} };
        map.set(r.cardId, entry);
      }
      entry.tags.push(r.tagId);
      entry.tagLabels[r.tagId] = r.displayName || r.tagId;
    }
    return map;
  }

  /** 複数カード行をまとめてタグ付きの Card に変換する（タグは1クエリでバッチ取得）。 */
  private async mapRows(rows: (typeof cards.$inferSelect)[]): Promise<Card[]> {
    const tagsByCard = await this.loadTagsForCards(rows.map((r) => r.id));
    return rows.map((row) => {
      const entry = tagsByCard.get(row.id) ?? { tags: [], tagLabels: {} };
      return this.mapRowToCard(row, entry.tags, entry.tagLabels);
    });
  }

  async findById(id: string): Promise<Card | null> {
    const cardRow = await this.db.select().from(cards).where(eq(cards.id, id)).get();
    if (!cardRow) return null;
    const { tags, tagLabels } = await this.loadTags(id);
    return this.mapRowToCard(cardRow, tags, tagLabels);
  }

  async findByOwnerId(ownerId: string): Promise<Card[]> {
    const rows = await this.db
      .select()
      .from(cards)
      .where(eq(cards.ownerId, ownerId))
      .orderBy(desc(cards.createdAt))
      .all();
    return this.mapRows(rows);
  }

  async findByOwnerIds(ownerIds: string[]): Promise<Card[]> {
    if (ownerIds.length === 0) return [];
    const rows = await this.db
      .select()
      .from(cards)
      .where(inArray(cards.ownerId, ownerIds))
      .orderBy(desc(cards.createdAt))
      .all();
    return this.mapRows(rows);
  }

  async findCandidateCardIdsByTags(
    tagIds: string[],
    targetType: CardType | readonly CardType[],
  ): Promise<CardTagHit[]> {
    if (tagIds.length === 0) return [];
    const types = Array.isArray(targetType) ? [...targetType] : [targetType];
    if (types.length === 0) return [];

    const results = await this.db
      .select({
        cardId: cardTags.cardId,
        tagId: cardTags.tagId,
        ownerId: cardTags.ownerId,
      })
      .from(cardTags)
      .where(and(inArray(cardTags.tagId, tagIds), inArray(cardTags.cardType, types)))
      .all();
    return results.map((r) => ({ cardId: r.cardId, tagId: r.tagId, ownerId: r.ownerId }));
  }

  async findRecentOpen(days: number, limit: number): Promise<Card[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const rows = await this.db
      .select()
      .from(cards)
      .where(and(eq(cards.status, "OPEN"), gte(cards.createdAt, since)))
      .orderBy(desc(cards.createdAt))
      .limit(limit)
      .all();
    return this.mapRows(rows);
  }

  async findByGeohashCells(cells: string[]): Promise<Card[]> {
    if (cells.length === 0) return [];
    const rows = await this.db
      .select()
      .from(cards)
      .where(and(eq(cards.status, "OPEN"), inArray(cards.geohash, cells)))
      .all();
    return this.mapRows(rows);
  }

  async findByIds(ids: string[]): Promise<Card[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.select().from(cards).where(inArray(cards.id, ids)).all();
    const byId = new Map(rows.map((r) => [r.id, r]));
    const ordered = ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [row] : [];
    });
    return this.mapRows(ordered);
  }

  async searchByTags(tagIds: string[], minMatch: number, type?: CardType): Promise<Card[]> {
    if (tagIds.length === 0) return [];

    const hitCount = sql<number>`count(distinct ${cardTags.tagId})`.as("hit_count");
    const conditions = [inArray(cardTags.tagId, tagIds), eq(cards.status, "OPEN")];
    if (type) conditions.push(eq(cards.type, type));

    const rows = await this.db
      .select({ cardId: cardTags.cardId, hitCount })
      .from(cardTags)
      .innerJoin(cards, eq(cards.id, cardTags.cardId))
      .where(and(...conditions))
      .groupBy(cardTags.cardId)
      .having(sql`count(distinct ${cardTags.tagId}) >= ${minMatch}`)
      .orderBy(desc(hitCount))
      .limit(60)
      .all();
    if (rows.length === 0) return [];

    const cardIds = rows.map((r) => r.cardId);
    const cardRows = await this.db.select().from(cards).where(inArray(cards.id, cardIds)).all();
    const byId = new Map(cardRows.map((r) => [r.id, r]));
    const ordered = cardIds.flatMap((id) => {
      const row = byId.get(id);
      return row ? [row] : [];
    });
    return this.mapRows(ordered);
  }

  async save(card: Card): Promise<void> {
    const props = card.toProps();
    const location = props.location ? new Location(props.location) : undefined;

    await this.db.insert(cards).values({
      id: props.id,
      ownerId: props.ownerId,
      type: props.type,
      title: props.title,
      note: props.note ?? null,
      minMatchCount: props.minMatchCount,
      requiredTags: JSON.stringify(props.requiredTags),
      dates: JSON.stringify(props.dates),
      lat: location?.lat ?? null,
      lon: location?.lon ?? null,
      locationName: location?.name ?? null,
      geohash: location ? location.geohash(6) : null,
      status: props.status,
      createdAt: props.createdAt,
      expiresAt: props.expiresAt,
    });

    const labels = props.tagLabels ?? {};
    if (props.tags.length > 0) {
      await this.db.insert(cardTags).values(
        props.tags.map((tagId) => ({
          cardId: props.id,
          tagId,
          ownerId: props.ownerId,
          cardType: props.type,
          displayName: labels[tagId] ?? tagId,
          createdAt: props.createdAt,
        })),
      );
    }
  }

  async updateStatus(id: string, status: Card["status"]): Promise<void> {
    await this.db.update(cards).set({ status }).where(eq(cards.id, id));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(cardTags).where(eq(cardTags.cardId, id));
    await this.db.delete(cards).where(eq(cards.id, id));
  }
}
