import { Context, Next } from "hono";
import { Env } from "./auth";

interface RateLimitOptions {
  key: string;
  limit: number;
  windowSec: number;
}

/**
 * リクエスト元 IP を1つに正規化する。
 *
 * CF-Connecting-IP は Cloudflare が付与する信頼できる単一 IP なのでそのまま使う。
 * それが無い場合の X-Forwarded-For はクライアントが任意の値を詰められるヘッダで、
 * かつ `client, proxy1, proxy2` のようにカンマ区切りで複数 IP が入りうる。先頭以外を
 * 拾ったり、リクエストごとに違う値を送られたりするとレート制限のキーが割れて簡単に
 * すり抜けられるため、必ず先頭（最も送信元に近い IP）だけを取り出して固定する。
 */
function clientIp(c: Context<Env>): string {
  const cfIp = c.req.header("CF-Connecting-IP");
  if (cfIp) return cfIp;
  const forwardedFor = c.req.header("X-Forwarded-For");
  const first = forwardedFor?.split(",")[0]?.trim();
  return first || "unknown";
}

export function rateLimit(options: RateLimitOptions) {
  return async (c: Context<Env>, next: Next) => {
    const ip = clientIp(c);
    const kvKey = `ratelimit:${options.key}:${ip}`;
    const current = Number((await c.env.CACHE_KV.get(kvKey)) ?? "0");
    if (current >= options.limit) {
      return c.json({ error: "Too many requests. Please try again later." }, 429);
    }
    await c.env.CACHE_KV.put(kvKey, String(current + 1), { expirationTtl: options.windowSec });
    return next();
  };
}
