import { and, desc, eq } from 'drizzle-orm';
import { IReviewRepository } from '../../../domain/review/IReviewRepository';
import { Review, ReviewProps } from '../../../domain/review/Review';
import { AppDatabase } from '../database';
import { reviews } from '../schema';

export class D1ReviewRepository implements IReviewRepository {
  constructor(private db: AppDatabase) {}

  private mapRow(row: typeof reviews.$inferSelect): Review {
    const props: ReviewProps = {
      id: row.id,
      matchId: row.matchId,
      fromUserId: row.fromUserId,
      toUserId: row.toUserId,
      rating: row.rating,
      comment: row.comment ?? undefined,
      createdAt: row.createdAt,
    };
    return new Review(props);
  }

  async existsForMatch(matchId: string, fromUserId: string): Promise<boolean> {
    const row = await this.db
      .select({ id: reviews.id })
      .from(reviews)
      .where(and(eq(reviews.matchId, matchId), eq(reviews.fromUserId, fromUserId)))
      .get();
    return !!row;
  }

  async findByToUserId(userId: string, limit = 50): Promise<Review[]> {
    const rows = await this.db
      .select()
      .from(reviews)
      .where(eq(reviews.toUserId, userId))
      .orderBy(desc(reviews.createdAt))
      .limit(limit)
      .all();
    return rows.map((r) => this.mapRow(r));
  }

  async save(review: Review): Promise<void> {
    const p = review.toProps();
    await this.db.insert(reviews).values({
      id: p.id,
      matchId: p.matchId,
      fromUserId: p.fromUserId,
      toUserId: p.toUserId,
      rating: p.rating,
      comment: p.comment ?? null,
      createdAt: p.createdAt,
    });
  }
}
