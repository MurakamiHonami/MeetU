import { and, desc, eq } from "drizzle-orm";
import { ISwipeRepository } from "../../../domain/feed/ISwipeRepository";
import { SwipeAction } from "../../../domain/feed/Swipe";
import { AppDatabase } from "../database";
import { swipes } from "../schema";

export class D1SwipeRepository implements ISwipeRepository {
  constructor(private db: AppDatabase) {}

  async record(userId: string, cardId: string, action: SwipeAction): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .insert(swipes)
      .values({ userId, cardId, action, createdAt: now })
      .onConflictDoUpdate({
        target: [swipes.userId, swipes.cardId],
        set: { action, createdAt: now },
      });
  }

  async findSwipedCardIds(userId: string): Promise<Set<string>> {
    const rows = await this.db
      .select({ cardId: swipes.cardId })
      .from(swipes)
      .where(eq(swipes.userId, userId))
      .all();
    return new Set(rows.map((r) => r.cardId));
  }

  async findSavedCardIds(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ cardId: swipes.cardId })
      .from(swipes)
      .where(and(eq(swipes.userId, userId), eq(swipes.action, "save")))
      .orderBy(desc(swipes.createdAt))
      .all();
    return rows.map((r) => r.cardId);
  }

  async removeSaved(userId: string, cardId: string): Promise<boolean> {
    const result = await this.db
      .delete(swipes)
      .where(and(eq(swipes.userId, userId), eq(swipes.cardId, cardId), eq(swipes.action, "save")));
    return (result.meta?.changes ?? 0) > 0;
  }
}
