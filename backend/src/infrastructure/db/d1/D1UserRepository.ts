import { eq, inArray } from "drizzle-orm";
import { IUserRepository } from "../../../domain/user/IUserRepository";
import { User, UserProps } from "../../../domain/user/User";
import { AppDatabase, parseJson } from "../database";
import { users } from "../schema";

export class D1UserRepository implements IUserRepository {
  constructor(private db: AppDatabase) {}

  private rowToProps(row: typeof users.$inferSelect): UserProps {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      salt: row.salt,
      xId: row.xId ?? undefined,
      displayName: row.displayName,
      pictureUrl: row.pictureUrl ?? undefined,
      ratingAvg: row.ratingAvg,
      ratingCount: row.ratingCount,
      reportCount: row.reportCount,
      tradeCount: row.tradeCount,
      favoriteTags: parseJson<string[]>(row.favoriteTags, []),
      favoriteLabels: parseJson<Record<string, string>>(row.favoriteLabels, {}),
      homeLocation:
        row.homeLat != null && row.homeLon != null
          ? { lat: row.homeLat, lon: row.homeLon, ...(row.homeName ? { name: row.homeName } : {}) }
          : undefined,
      status: row.status as UserProps["status"],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.db.select().from(users).where(eq(users.id, id)).get();
    return row ? new User(this.rowToProps(row)) : null;
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.select().from(users).where(inArray(users.id, ids)).all();
    return rows.map((row) => new User(this.rowToProps(row)));
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db.select().from(users).where(eq(users.email, email)).get();
    return row ? new User(this.rowToProps(row)) : null;
  }

  async findByXId(xId: string): Promise<User | null> {
    const row = await this.db.select().from(users).where(eq(users.xId, xId)).get();
    return row ? new User(this.rowToProps(row)) : null;
  }

  async save(user: User): Promise<void> {
    const p = user.toProps();
    const home = p.homeLocation;
    await this.db.insert(users).values({
      id: p.id,
      email: p.email,
      passwordHash: p.passwordHash,
      salt: p.salt,
      xId: p.xId ?? null,
      displayName: p.displayName,
      pictureUrl: p.pictureUrl ?? null,
      ratingAvg: p.ratingAvg,
      ratingCount: p.ratingCount,
      reportCount: p.reportCount,
      tradeCount: p.tradeCount,
      favoriteTags: JSON.stringify(p.favoriteTags),
      favoriteLabels: JSON.stringify(p.favoriteLabels ?? {}),
      homeLat: home?.lat ?? null,
      homeLon: home?.lon ?? null,
      homeName: home?.name ?? null,
      status: p.status,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    });
  }

  async update(user: User): Promise<void> {
    const p = user.toProps();
    const home = p.homeLocation;
    await this.db
      .update(users)
      .set({
        displayName: p.displayName,
        pictureUrl: p.pictureUrl ?? null,
        ratingAvg: p.ratingAvg,
        ratingCount: p.ratingCount,
        reportCount: p.reportCount,
        tradeCount: p.tradeCount,
        favoriteTags: JSON.stringify(p.favoriteTags),
        favoriteLabels: JSON.stringify(p.favoriteLabels ?? {}),
        homeLat: home?.lat ?? null,
        homeLon: home?.lon ?? null,
        homeName: home?.name ?? null,
        status: p.status,
        updatedAt: p.updatedAt,
      })
      .where(eq(users.id, p.id));
  }
}
