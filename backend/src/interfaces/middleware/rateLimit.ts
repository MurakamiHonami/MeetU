import { Context, Next } from "hono";
import { Env } from "./auth";

interface RateLimitOptions {
  key: string;
  limit: number;
  windowSec: number;
}

export function rateLimit(options: RateLimitOptions) {
  return async (c: Context<Env>, next: Next) => {
    const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For") ?? "unknown";
    const kvKey = `ratelimit:${options.key}:${ip}`;
    const current = Number((await c.env.CACHE_KV.get(kvKey)) ?? "0");
    if (current >= options.limit) {
      return c.json({ error: "Too many requests. Please try again later." }, 429);
    }
    await c.env.CACHE_KV.put(kvKey, String(current + 1), { expirationTtl: options.windowSec });
    return next();
  };
}
