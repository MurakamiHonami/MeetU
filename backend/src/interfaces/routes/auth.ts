import { Hono } from 'hono';
import { Env } from '../middleware/auth';
import { createDb } from '../../infrastructure/db/database';
import { D1UserRepository } from '../../infrastructure/db/d1/D1UserRepository';
import { AuthService } from '../../infrastructure/auth/AuthService';
import { User } from '../../domain/user/User';

export const authRouter = new Hono<Env>()
  // 1. サインアップ (ユーザー登録)
  .post('/signup', async (c) => {
    const body = await c.req.json<{ email: string; password: string; displayName: string }>();
    if (!body.email || !body.password || !body.displayName) {
      return c.json({ error: 'email, password, and displayName are required' }, 400);
    }

    const userRepo = new D1UserRepository(createDb(c.env.DB));
    const existing = await userRepo.findByEmail(body.email);
    if (existing) {
      return c.json({ error: 'Email already registered' }, 409);
    }

    const salt = AuthService.generateSalt();
    const passwordHash = await AuthService.hashPassword(body.password, salt);

    const user = User.create(body.email, passwordHash, salt, body.displayName);
    await userRepo.save(user);

    const authService = new AuthService(c.env.CACHE_KV, c.env.JWT_SECRET);
    const tokens = await authService.createTokenPair(user.id, user.email);

    return c.json({
      user: user.toPublicProfile(),
      tokens,
    }, 201);
  })

  // 2. ログイン
  .post('/login', async (c) => {
    const body = await c.req.json<{ email: string; password: string }>();
    if (!body.email || !body.password) {
      return c.json({ error: 'email and password are required' }, 400);
    }

    const userRepo = new D1UserRepository(createDb(c.env.DB));
    const user = await userRepo.findByEmail(body.email);
    if (!user) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    const valid = await AuthService.verifyPassword(body.password, user.salt, user.passwordHash);
    if (!valid) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    if (user.isSuspended()) {
      return c.json({ error: 'Account is suspended' }, 403);
    }

    const authService = new AuthService(c.env.CACHE_KV, c.env.JWT_SECRET);
    const tokens = await authService.createTokenPair(user.id, user.email);

    return c.json({
      user: user.toPublicProfile(),
      tokens,
    });
  })

  // 3. トークンリフレッシュ (Refresh Token -> Access Token / Refresh Token 再発行)
  .post('/refresh', async (c) => {
    const body = await c.req.json<{ refreshToken: string }>();
    if (!body.refreshToken) {
      return c.json({ error: 'refreshToken is required' }, 400);
    }

    const authService = new AuthService(c.env.CACHE_KV, c.env.JWT_SECRET);
    const newTokens = await authService.refreshTokenPair(body.refreshToken);

    if (!newTokens) {
      return c.json({ error: 'Invalid or expired refresh token' }, 401);
    }

    return c.json({ tokens: newTokens });
  })

  // 4. ログアウト (Refresh Token 失効)
  .post('/logout', async (c) => {
    const body = await c.req.json<{ refreshToken: string }>();
    if (body.refreshToken) {
      const authService = new AuthService(c.env.CACHE_KV, c.env.JWT_SECRET);
      await authService.revokeRefreshToken(body.refreshToken);
    }
    return c.json({ success: true });
  });
