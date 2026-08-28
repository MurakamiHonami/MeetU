import { Context, Next } from 'hono';
import { AuthService } from '../../infrastructure/auth/AuthService';

export interface Env {
  Bindings: {
    DB: D1Database;
    CACHE_KV: KVNamespace;
    UPLOADS_R2: R2Bucket;
    JWT_SECRET: string;
    APP_ENV?: string;
    CORS_ORIGINS?: string;
    COOKIE_DOMAIN?: string;
  };
  Variables: {
    userId: string;
    email: string;
  };
}

export async function authMiddleware(c: Context<Env>, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: Missing or invalid token format' }, 401);
  }

  const token = authHeader.substring(7);

  // テスト・開発用モック
  if (token.startsWith('mock_')) {
    c.set('userId', token.replace('mock_', ''));
    c.set('email', `${token}@example.com`);
    return next();
  }

  const payload = await AuthService.verifyAccessToken(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: 'Unauthorized: Invalid or expired access token' }, 401);
  }

  c.set('userId', payload.userId);
  c.set('email', payload.email);
  return next();
}
