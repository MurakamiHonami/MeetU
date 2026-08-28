import { Context } from "hono";
import { Env } from "./auth";

export function isLocalEnv(appEnv?: string): boolean {
  return !appEnv || appEnv === "local";
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
