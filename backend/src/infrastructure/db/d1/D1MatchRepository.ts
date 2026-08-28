import { and, desc, eq, or, sql } from 'drizzle-orm';
import { IMatchRepository } from '../../../domain/match/IMatchRepository';
import { Match, MatchProps } from '../../../domain/match/Match';
import { AppDatabase, parseJson } from '../database';
import { matchReads, matches } from '../schema';

export class D1MatchRepository implements IMatchRepository {
  constructor(private db: AppDatabase) {}

  private mapRow(row: typeof matches.$inferSelect): Match {
    const props: MatchProps = {
      id: row.id,
      cardAId: row.cardAId,
      cardBId: row.cardBId,
      userAId: row.userAId,
      userBId: row.userBId,
      matchedTags: parseJson<string[]>(row.matchedTags, []),
      matchedLabels: parseJson<string[]>(row.matchedLabels, []),
      matchCount: row.matchCount,
      distanceKm: row.distanceKm ?? undefined,
      acceptedA: !!row.acceptedA,
      acceptedB: !!row.acceptedB,
      lastMessageAt: row.lastMessageAt ?? undefined,
      lastMessageBy: row.lastMessageBy ?? undefined,
      lastMessagePreview: row.lastMessagePreview ?? undefined,
      status: row.status as MatchProps['status'],
      createdAt: row.createdAt,
    };
    return new Match(props);
  }

  async findById(id: string): Promise<Match | null> {
    const row = await this.db.select().from(matches).where(eq(matches.id, id)).get();
    return row ? this.mapRow(row) : null;
  }

  async findByUserId(userId: string): Promise<Match[]> {
    const rows = await this.db
      .select()
      .from(matches)
      .where(or(eq(matches.userAId, userId), eq(matches.userBId, userId)))
      .orderBy(desc(sql`coalesce(${matches.lastMessageAt}, ${matches.createdAt})`))
      .all();
    return rows.map((row) => this.mapRow(row));
  }

  async save(match: Match): Promise<void> {
    const props = match.toProps();
    await this.db
      .insert(matches)
      .values({
        id: props.id,
        cardAId: props.cardAId,
        cardBId: props.cardBId,
        userAId: props.userAId,
        userBId: props.userBId,
        matchedTags: JSON.stringify(props.matchedTags),
        matchedLabels: JSON.stringify(props.matchedLabels ?? props.matchedTags),
        matchCount: props.matchCount,
        distanceKm: props.distanceKm ?? null,
        acceptedA: props.acceptedA ? 1 : 0,
        acceptedB: props.acceptedB ? 1 : 0,
        lastMessageAt: props.lastMessageAt ?? null,
        lastMessageBy: props.lastMessageBy ?? null,
        lastMessagePreview: props.lastMessagePreview ?? null,
        status: props.status,
        createdAt: props.createdAt,
      })
      .onConflictDoUpdate({
        target: matches.id,
        set: {
          status: sql`excluded.status`,
          acceptedA: sql`excluded.accepted_a`,
          acceptedB: sql`excluded.accepted_b`,
          lastMessageAt: sql`excluded.last_message_at`,
          lastMessageBy: sql`excluded.last_message_by`,
          lastMessagePreview: sql`excluded.last_message_preview`,
        },
      });
  }

  async updateStatus(id: string, status: Match['status']): Promise<void> {
    await this.db.update(matches).set({ status }).where(eq(matches.id, id));
  }

  async getLastReadAt(matchId: string, userId: string): Promise<string | null> {
    const row = await this.db
      .select({ lastReadAt: matchReads.lastReadAt })
      .from(matchReads)
      .where(and(eq(matchReads.matchId, matchId), eq(matchReads.userId, userId)))
      .get();
    return row?.lastReadAt ?? null;
  }

  async markRead(matchId: string, userId: string, at: string): Promise<void> {
    await this.db
      .insert(matchReads)
      .values({ matchId, userId, lastReadAt: at })
      .onConflictDoUpdate({
        target: [matchReads.matchId, matchReads.userId],
        set: { lastReadAt: at },
      });
  }
}
