import { desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import { ITagRepository, RelatedTagHit } from '../../../domain/tag/ITagRepository';
import { Tag, TagProps } from '../../../domain/tag/Tag';
import { AppDatabase } from '../database';
import { tagCooccurrences, tags } from '../schema';

export class D1TagRepository implements ITagRepository {
  constructor(private db: AppDatabase) {}

  private mapRow(row: typeof tags.$inferSelect): Tag {
    const props: TagProps = {
      id: row.id,
      displayName: row.displayName,
      category: row.category,
      useCount: row.useCount,
    };
    return new Tag(props);
  }

  async findById(id: string): Promise<Tag | null> {
    const row = await this.db.select().from(tags).where(eq(tags.id, id)).get();
    return row ? this.mapRow(row) : null;
  }

  async suggest(query: string, limit = 20): Promise<Tag[]> {
    const pattern = `%${query.toLowerCase()}%`;
    const rows = await this.db
      .select()
      .from(tags)
      .where(or(like(tags.id, pattern), like(tags.displayName, pattern)))
      .orderBy(desc(tags.useCount))
      .limit(limit)
      .all();
    return rows.map((row) => this.mapRow(row));
  }

  async save(tag: Tag): Promise<void> {
    const p = tag.toProps();
    await this.db
      .insert(tags)
      .values({ id: p.id, displayName: p.displayName, category: p.category, useCount: p.useCount })
      .onConflictDoUpdate({
        target: tags.id,
        set: { useCount: sql`${tags.useCount} + 1` },
      });
  }

  async incrementCounts(tagIds: string[]): Promise<void> {
    if (tagIds.length === 0) return;
    await this.db
      .update(tags)
      .set({ useCount: sql`${tags.useCount} + 1` })
      .where(inArray(tags.id, tagIds));
  }

  async findRelatedTags(tagId: string, limit = 5): Promise<RelatedTagHit[]> {
    const rowsA = await this.db
      .select({ related: tagCooccurrences.tagB, hits: tagCooccurrences.hits })
      .from(tagCooccurrences)
      .where(eq(tagCooccurrences.tagA, tagId))
      .orderBy(desc(tagCooccurrences.hits))
      .limit(limit)
      .all();
    const rowsB = await this.db
      .select({ related: tagCooccurrences.tagA, hits: tagCooccurrences.hits })
      .from(tagCooccurrences)
      .where(eq(tagCooccurrences.tagB, tagId))
      .orderBy(desc(tagCooccurrences.hits))
      .limit(limit)
      .all();
    const merged = [...rowsA, ...rowsB]
      .sort((a, b) => b.hits - a.hits)
      .slice(0, limit);
    return merged.map((r) => ({ tagId: r.related, hits: r.hits }));
  }

  async recordCooccurrences(tagIds: string[]): Promise<void> {
    if (tagIds.length < 2) return;
    const sorted = [...tagIds].sort();
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        await this.db
          .insert(tagCooccurrences)
          .values({ tagA: sorted[i], tagB: sorted[j], hits: 1 })
          .onConflictDoUpdate({
            target: [tagCooccurrences.tagA, tagCooccurrences.tagB],
            set: { hits: sql`${tagCooccurrences.hits} + 1` },
          });
      }
    }
  }
}
