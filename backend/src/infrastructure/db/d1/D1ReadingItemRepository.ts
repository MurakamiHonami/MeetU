import { and, desc, eq } from "drizzle-orm";
import { IReadingItemRepository } from "../../../domain/reading/IReadingItemRepository";
import { ReadingItem, ReadingItemProps, ReadingStatus } from "../../../domain/reading/ReadingItem";
import { AppDatabase } from "../database";
import { readingItems } from "../schema";

export class D1ReadingItemRepository implements IReadingItemRepository {
  constructor(private db: AppDatabase) {}

  private mapRow(row: typeof readingItems.$inferSelect): ReadingItem {
    const props: ReadingItemProps = {
      id: row.id,
      ownerId: row.ownerId,
      isbn: row.isbn ?? undefined,
      title: row.title,
      author: row.author ?? undefined,
      coverUrl: row.coverUrl ?? undefined,
      status: row.status as ReadingStatus,
      note: row.note ?? undefined,
      cardId: row.cardId ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    return new ReadingItem(props);
  }

  async findById(id: string): Promise<ReadingItem | null> {
    const row = await this.db.select().from(readingItems).where(eq(readingItems.id, id)).get();
    return row ? this.mapRow(row) : null;
  }

  async findByOwner(ownerId: string, status?: ReadingStatus): Promise<ReadingItem[]> {
    const where = status
      ? and(eq(readingItems.ownerId, ownerId), eq(readingItems.status, status))
      : eq(readingItems.ownerId, ownerId);
    const rows = await this.db
      .select()
      .from(readingItems)
      .where(where)
      .orderBy(desc(readingItems.createdAt))
      .all();
    return rows.map((r) => this.mapRow(r));
  }

  async existsByOwnerAndIsbn(ownerId: string, isbn: string): Promise<boolean> {
    const row = await this.db
      .select({ id: readingItems.id })
      .from(readingItems)
      .where(and(eq(readingItems.ownerId, ownerId), eq(readingItems.isbn, isbn)))
      .get();
    return !!row;
  }

  async save(item: ReadingItem): Promise<void> {
    const p = item.toProps();
    await this.db.insert(readingItems).values({
      id: p.id,
      ownerId: p.ownerId,
      isbn: p.isbn ?? null,
      title: p.title,
      author: p.author ?? null,
      coverUrl: p.coverUrl ?? null,
      status: p.status,
      note: p.note ?? null,
      cardId: p.cardId ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    });
  }

  async update(item: ReadingItem): Promise<void> {
    const p = item.toProps();
    await this.db
      .update(readingItems)
      .set({
        isbn: p.isbn ?? null,
        title: p.title,
        author: p.author ?? null,
        coverUrl: p.coverUrl ?? null,
        status: p.status,
        note: p.note ?? null,
        cardId: p.cardId ?? null,
        updatedAt: p.updatedAt,
      })
      .where(eq(readingItems.id, p.id));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(readingItems).where(eq(readingItems.id, id));
  }
}
