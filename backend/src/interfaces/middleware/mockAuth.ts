import { Context } from "hono";
import { Env } from "./auth";

/**
 * `local` を明示的に指定した場合のみ true。
 *
 * fail-closed にしてある: APP_ENV が未設定（デフォルト値の欠落・新環境追加時の設定漏れ等）の
 * ときに誤ってモック認証（mock_ トークンで任意の userId を詐称できる）が有効になる事故を防ぐ。
 * 新しい wrangler 環境を追加するときは vars.APP_ENV を必ず明示すること。
 */
export function isLocalEnv(appEnv?: string): boolean {
  return appEnv === "local";
}

export function tryMockAuth(c: Context<Env>, token: string): boolean {
  if (!token.startsWith("mock_")) return false;
  if (!isLocalEnv(c.env.APP_ENV)) return false;
  c.set("userId", token.replace("mock_", ""));
  c.set("email", `${token}@example.com`);
  return true;
}

export function mockUserIdFromToken(c: Context<Env>, token: string): string | null {
  if (!token.startsWith("mock_")) return null;
  if (!isLocalEnv(c.env.APP_ENV)) return null;
  return token.replace("mock_", "");
}
