import { and, desc, eq } from 'drizzle-orm';
import { IGroupRepository } from '../../../domain/group/IGroupRepository';
import { TradeGroup, TradeGroupProps } from '../../../domain/group/TradeGroup';
import { AppDatabase, parseJson } from '../database';
import { tradeGroupMembers, tradeGroups } from '../schema';

export class D1GroupRepository implements IGroupRepository {
  constructor(private db: AppDatabase) {}

  private mapRow(row: typeof tradeGroups.$inferSelect): TradeGroup {
    const props: TradeGroupProps = {
      id: row.id,
      length: row.length,
      steps: parseJson(row.steps, []),
      members: parseJson<string[]>(row.members, []),
      responses: parseJson(row.responses, {}),
      foundBy: row.foundBy ?? undefined,
      lastMessageAt: row.lastMessageAt ?? undefined,
      lastMessageBy: row.lastMessageBy ?? undefined,
      lastMessagePreview: row.lastMessagePreview ?? undefined,
      status: row.status as TradeGroupProps['status'],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt ?? undefined,
    };
    return new TradeGroup(props);
  }

  async findById(id: string): Promise<TradeGroup | null> {
    const row = await this.db.select().from(tradeGroups).where(eq(tradeGroups.id, id)).get();
    return row ? this.mapRow(row) : null;
  }

  async findByUserId(userId: string): Promise<TradeGroup[]> {
    const rows = await this.db
      .select({ group: tradeGroups })
      .from(tradeGroups)
      .innerJoin(tradeGroupMembers, eq(tradeGroupMembers.groupId, tradeGroups.id))
      .where(eq(tradeGroupMembers.userId, userId))
      .orderBy(desc(tradeGroups.createdAt))
      .all();
    return rows.map((row) => this.mapRow(row.group));
  }

  async create(group: TradeGroup): Promise<boolean> {
    const existing = await this.findById(group.id);
    if (existing) return false;

    const p = group.toProps();
    const now = new Date().toISOString();
    await this.db.insert(tradeGroups).values({
      id: p.id,
      length: p.length,
      steps: JSON.stringify(p.steps),
      members: JSON.stringify(p.members),
      responses: JSON.stringify(p.responses),
      foundBy: p.foundBy ?? null,
      status: p.status,
      createdAt: p.createdAt,
      updatedAt: now,
    });

    for (const memberId of p.members) {
      await this.db.insert(tradeGroupMembers).values({ groupId: p.id, userId: memberId });
    }
    return true;
  }

  async update(group: TradeGroup): Promise<void> {
    const p = group.toProps();
    await this.db
      .update(tradeGroups)
      .set({
        responses: JSON.stringify(p.responses),
        status: p.status,
        lastMessageAt: p.lastMessageAt ?? null,
        lastMessageBy: p.lastMessageBy ?? null,
        lastMessagePreview: p.lastMessagePreview ?? null,
        updatedAt: p.updatedAt ?? new Date().toISOString(),
      })
      .where(eq(tradeGroups.id, p.id));
  }

  async getLastReadAt(groupId: string, userId: string): Promise<string | null> {
    const row = await this.db
      .select({ lastReadAt: tradeGroupMembers.lastReadAt })
      .from(tradeGroupMembers)
      .where(and(eq(tradeGroupMembers.groupId, groupId), eq(tradeGroupMembers.userId, userId)))
      .get();
    return row?.lastReadAt ?? null;
  }

  async markRead(groupId: string, userId: string, at: string): Promise<void> {
    await this.db
      .insert(tradeGroupMembers)
      .values({ groupId, userId, lastReadAt: at })
      .onConflictDoUpdate({
        target: [tradeGroupMembers.groupId, tradeGroupMembers.userId],
        set: { lastReadAt: at },
      });
  }

  async ensureMember(groupId: string, userId: string): Promise<void> {
    await this.db
      .insert(tradeGroupMembers)
      .values({ groupId, userId })
      .onConflictDoNothing();
  }
}
