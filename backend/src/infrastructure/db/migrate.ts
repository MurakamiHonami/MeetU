import initialSql from '../../../drizzle/0000_initial.sql?raw';

function splitStatements(sql: string): string[] {
  return sql
    .split(/-->\s*statement-breakpoint\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** D1（Vitest）にスキーマを適用する。本番は wrangler d1 migrations apply を使う。 */
export async function migrateToLatest(d1: D1Database): Promise<void> {
  const exists = await d1
    .prepare("SELECT 1 as ok FROM sqlite_master WHERE type='table' AND name='users'")
    .first();
  if (exists) return;

  for (const stmt of splitStatements(initialSql)) {
    await d1.prepare(stmt).run();
  }
}
