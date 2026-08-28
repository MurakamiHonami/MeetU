import { Context, Next } from "hono";
import { Env } from "./auth";

interface UserRateLimitOptions {
  key: string;
  limit: number;
  windowSec: number;
}

export function userRateLimit(options: UserRateLimitOptions) {
  return async (c: Context<Env>, next: Next) => {
    const userId = c.get("userId");
    const kvKey = `ratelimit:${options.key}:${userId}`;
    const current = Number((await c.env.CACHE_KV.get(kvKey)) ?? "0");
    if (current >= options.limit) {
      return c.json({ error: "リクエストが多すぎます。しばらく待ってからお試しください。" }, 429);
    }
    await c.env.CACHE_KV.put(kvKey, String(current + 1), { expirationTtl: options.windowSec });
    return next();
  };
}
