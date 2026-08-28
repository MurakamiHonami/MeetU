import { asc, and, eq, gt } from "drizzle-orm";
import { IMessageRepository } from "../../../domain/message/IMessageRepository";
import { Message, MessageProps } from "../../../domain/message/Message";
import { AppDatabase } from "../database";
import { messages } from "../schema";

export class D1MessageRepository implements IMessageRepository {
  constructor(private db: AppDatabase) {}

  private mapRow(row: typeof messages.$inferSelect): Message {
    const props: MessageProps = {
      id: row.id,
      threadType: row.threadType as MessageProps["threadType"],
      threadId: row.threadId,
      senderId: row.senderId,
      kind: row.kind as MessageProps["kind"],
      text: row.text ?? undefined,
      imageKey: row.imageKey ?? undefined,
      location:
        row.lat != null && row.lon != null
          ? { lat: row.lat, lon: row.lon, ...(row.locationName ? { name: row.locationName } : {}) }
          : undefined,
      createdAt: row.createdAt,
    };
    return new Message(props);
  }

  async findById(id: string): Promise<Message | null> {
    const row = await this.db.select().from(messages).where(eq(messages.id, id)).get();
    return row ? this.mapRow(row) : null;
  }

  async findByThread(
    threadType: Message["threadType"],
    threadId: string,
    after?: string,
    limit = 100,
  ): Promise<Message[]> {
    const conditions = [eq(messages.threadType, threadType), eq(messages.threadId, threadId)];

    if (after) {
      const afterMsg = await this.findById(after);
      if (afterMsg) conditions.push(gt(messages.createdAt, afterMsg.createdAt));
    }

    const rows = await this.db
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(asc(messages.createdAt))
      .limit(limit)
      .all();
    return rows.map((r) => this.mapRow(r));
  }

  async save(message: Message): Promise<void> {
    const p = message.toProps();
    const loc = p.location;
    await this.db.insert(messages).values({
      id: p.id,
      threadType: p.threadType,
      threadId: p.threadId,
      senderId: p.senderId,
      kind: p.kind,
      text: p.text ?? null,
      imageKey: p.imageKey ?? null,
      lat: loc?.lat ?? null,
      lon: loc?.lon ?? null,
      locationName: loc?.name ?? null,
      createdAt: p.createdAt,
    });
  }
}
