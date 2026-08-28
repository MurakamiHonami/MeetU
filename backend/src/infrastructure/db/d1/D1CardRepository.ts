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

  async findById(id: string): Promise<Card | null> {
    const cardRow = await this.db.select().from(cards).where(eq(cards.id, id)).get();
    if (!cardRow) return null;
    const { tags, tagLabels } = await this.loadTags(id);
    return this.mapRowToCard(cardRow, tags, tagLabels);
  }

  async findByOwnerId(ownerId: string): Promise<Card[]> {
    const rows = await this.db
      .select({ id: cards.id })
      .from(cards)
      .where(eq(cards.ownerId, ownerId))
      .orderBy(desc(cards.createdAt))
      .all();
    const result: Card[] = [];
    for (const r of rows) {
      const card = await this.findById(r.id);
      if (card) result.push(card);
    }
    return result;
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
      .select({ id: cards.id })
      .from(cards)
      .where(and(eq(cards.status, "OPEN"), gte(cards.createdAt, since)))
      .orderBy(desc(cards.createdAt))
      .limit(limit)
      .all();
    const result: Card[] = [];
    for (const r of rows) {
      const card = await this.findById(r.id);
      if (card) result.push(card);
    }
    return result;
  }

  async findByGeohashCells(cells: string[]): Promise<Card[]> {
    if (cells.length === 0) return [];
    const rows = await this.db
      .select({ id: cards.id })
      .from(cards)
      .where(and(eq(cards.status, "OPEN"), inArray(cards.geohash, cells)))
      .all();
    const result: Card[] = [];
    for (const r of rows) {
      const card = await this.findById(r.id);
      if (card) result.push(card);
    }
    return result;
  }

  async findByIds(ids: string[]): Promise<Card[]> {
    const result: Card[] = [];
    for (const id of ids) {
      const card = await this.findById(id);
      if (card) result.push(card);
    }
    return result;
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
    const result: Card[] = [];
    for (const r of rows) {
      const card = await this.findById(r.cardId);
      if (card) result.push(card);
    }
    return result;
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
    for (const tagId of props.tags) {
      await this.db.insert(cardTags).values({
        cardId: props.id,
        tagId,
        ownerId: props.ownerId,
        cardType: props.type,
        displayName: labels[tagId] ?? tagId,
        createdAt: props.createdAt,
      });
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
