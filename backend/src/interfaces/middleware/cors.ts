import type { Context, Next } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './auth';

const DEFAULT_ORIGINS = 'http://localhost:5173';

export function parseCorsOrigins(origins?: string): string[] {
  return (origins ?? DEFAULT_ORIGINS)
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export function corsMiddleware() {
  return async (c: Context<Env>, next: Next) => {
    const allowed = parseCorsOrigins(c.env.CORS_ORIGINS);
    const handler = cors({
      origin: (origin) => {
        if (!origin) return allowed[0] ?? DEFAULT_ORIGINS;
        return allowed.includes(origin) ? origin : '';
      },
      credentials: true,
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    });
    return handler(c, next);
  };
}
