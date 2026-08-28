import { Hono } from "hono";
import { Env } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { createDb } from "../../infrastructure/db/database";
import { D1UserRepository } from "../../infrastructure/db/d1/D1UserRepository";
import { AuthService } from "../../infrastructure/auth/AuthService";
import { User } from "../../domain/user/User";
import { clearRefreshCookie, readRefreshToken, setRefreshCookie } from "../auth/cookies";
import { toPublicTokens } from "../auth/tokens";
import { parseBody } from "../validation/parseBody";
import { zValidator } from "../validation/validator";
import { loginSchema, refreshSchema, signupSchema } from "../validation/schemas";

async function resolveRefreshToken(
  c: { req: { json: <T>() => Promise<T> } },
  fromCookie: string | null,
): Promise<string | null> {
  if (fromCookie) return fromCookie;
  try {
    const body = await c.req.json<{ refreshToken?: string }>();
    const parsed = parseBody(refreshSchema, body);
    if (!parsed.ok) return null;
    return parsed.data.refreshToken ?? null;
  } catch {
    return null;
  }
}

const authRateLimit = rateLimit({ key: "auth", limit: 30, windowSec: 60 });

export const authRouter = new Hono<Env>()
  .use("*", authRateLimit)

  .post("/signup", zValidator("json", signupSchema), async (c) => {
    const body = c.req.valid("json");

    const userRepo = new D1UserRepository(createDb(c.env.DB));
    const existing = await userRepo.findByEmail(body.email);
    if (existing) {
      return c.json({ error: "Email already registered" }, 409);
    }

    const salt = AuthService.generateSalt();
    const passwordHash = await AuthService.hashPassword(body.password, salt);

    const user = User.create(body.email, passwordHash, salt, body.displayName);
    await userRepo.save(user);

    const authService = new AuthService(c.env.CACHE_KV, c.env.JWT_SECRET);
    const tokens = await authService.createTokenPair(user.id, user.email);
    setRefreshCookie(c, tokens.refreshToken);

    return c.json(
      {
        user: user.toPublicProfile(),
        tokens: toPublicTokens(tokens),
      },
      201,
    );
  })

  .post("/login", zValidator("json", loginSchema), async (c) => {
    const body = c.req.valid("json");

    const userRepo = new D1UserRepository(createDb(c.env.DB));
    const user = await userRepo.findByEmail(body.email);
    if (!user) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const valid = await AuthService.verifyPassword(body.password, user.salt, user.passwordHash);
    if (!valid) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    if (user.isSuspended()) {
      return c.json({ error: "Account is suspended" }, 403);
    }

    const authService = new AuthService(c.env.CACHE_KV, c.env.JWT_SECRET);
    const tokens = await authService.createTokenPair(user.id, user.email);
    setRefreshCookie(c, tokens.refreshToken);

    return c.json({
      user: user.toPublicProfile(),
      tokens: toPublicTokens(tokens),
    });
  })

  .post("/refresh", async (c) => {
    const refreshToken = await resolveRefreshToken(c, readRefreshToken(c));
    if (!refreshToken) {
      return c.json({ error: "refresh token required" }, 401);
    }

    const authService = new AuthService(c.env.CACHE_KV, c.env.JWT_SECRET);
    const newTokens = await authService.refreshTokenPair(refreshToken);

    if (!newTokens) {
      clearRefreshCookie(c);
      return c.json({ error: "Invalid or expired refresh token" }, 401);
    }

    setRefreshCookie(c, newTokens.refreshToken);
    return c.json({ tokens: toPublicTokens(newTokens) });
  })

  .post("/logout", async (c) => {
    const refreshToken = await resolveRefreshToken(c, readRefreshToken(c));
    if (refreshToken) {
      const authService = new AuthService(c.env.CACHE_KV, c.env.JWT_SECRET);
      await authService.revokeRefreshToken(refreshToken);
    }
    clearRefreshCookie(c);
    return c.json({ success: true });
  });
