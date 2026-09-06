import initialSql from "../../../drizzle/0000_initial.sql?raw";
import addXIdSql from "../../../drizzle/0001_add_x_id.sql?raw";

function splitStatements(sql: string): string[] {
  return sql
    .split(/-->\s*statement-breakpoint\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function tableExists(d1: D1Database, name: string): Promise<boolean> {
  const row = await d1
    .prepare("SELECT 1 as ok FROM sqlite_master WHERE type='table' AND name=?")
    .bind(name)
    .first();
  return Boolean(row);
}

async function columnExists(d1: D1Database, table: string, column: string): Promise<boolean> {
  const { results } = await d1.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  return results.some((r) => r.name === column);
}

async function apply(d1: D1Database, sql: string): Promise<void> {
  for (const stmt of splitStatements(sql)) {
    await d1.prepare(stmt).run();
  }
}

/** D1（Vitest）にスキーマを適用する。本番は wrangler d1 migrations apply を使う。 */
export async function migrateToLatest(d1: D1Database): Promise<void> {
  if (!(await tableExists(d1, "users"))) {
    await apply(d1, initialSql);
  }
  if (!(await columnExists(d1, "users", "x_id"))) {
    await apply(d1, addXIdSql);
  }
}
