import { Hono } from "hono";
import { Env } from "../middleware/auth";
import { parseCorsOrigins } from "../middleware/cors";
import { rateLimit } from "../middleware/rateLimit";
import { createDb } from "../../infrastructure/db/database";
import { D1UserRepository } from "../../infrastructure/db/d1/D1UserRepository";
import { AuthService } from "../../infrastructure/auth/AuthService";
import { XOAuthClient, XOAuthConfig } from "../../infrastructure/auth/XOAuthClient";
import { User } from "../../domain/user/User";
import { clearRefreshCookie, readRefreshToken, setRefreshCookie } from "../auth/cookies";
import { toPublicTokens } from "../auth/tokens";
import { parseBody } from "../validation/parseBody";
import { zValidator } from "../validation/validator";
import { loginSchema, refreshSchema, signupSchema } from "../validation/schemas";

const X_OAUTH_STATE_TTL_SEC = 10 * 60;

function xOAuthConfig(c: { env: Env["Bindings"] }): XOAuthConfig | null {
  const { X_CLIENT_ID, X_CLIENT_SECRET, X_REDIRECT_URI } = c.env;
  if (!X_CLIENT_ID || !X_CLIENT_SECRET || !X_REDIRECT_URI) return null;
  return { clientId: X_CLIENT_ID, clientSecret: X_CLIENT_SECRET, redirectUri: X_REDIRECT_URI };
}

function frontendUrl(c: { env: Env["Bindings"] }): string {
  return parseCorsOrigins(c.env.CORS_ORIGINS)[0] ?? "/";
}

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
  })

  // X (Twitter) OAuth 2.0 Authorization Code + PKCE。ブラウザの直接遷移で使うため
  // フロントの hc<AppType> RPC は経由しない（zValidator の対象外）。
  .get("/x/login", async (c) => {
    const config = xOAuthConfig(c);
    if (!config) {
      return c.json({ error: "X login is not configured" }, 503);
    }

    const client = new XOAuthClient(config);
    const state = XOAuthClient.generateState();
    const codeVerifier = XOAuthClient.generateCodeVerifier();
    await c.env.CACHE_KV.put(`x_oauth_state:${state}`, codeVerifier, {
      expirationTtl: X_OAUTH_STATE_TTL_SEC,
    });

    return c.redirect(await client.createAuthorizationUrl(state, codeVerifier));
  })

  .get("/x/callback", async (c) => {
    const loginFailedUrl = `${frontendUrl(c)}/login?error=x_oauth_failed`;
    const config = xOAuthConfig(c);
    const code = c.req.query("code");
    const state = c.req.query("state");
    if (!config || c.req.query("error") || !code || !state) {
      return c.redirect(loginFailedUrl);
    }

    const stateKey = `x_oauth_state:${state}`;
    const codeVerifier = await c.env.CACHE_KV.get(stateKey);
    if (!codeVerifier) {
      return c.redirect(loginFailedUrl);
    }
    await c.env.CACHE_KV.delete(stateKey);

    const client = new XOAuthClient(config);
    const accessToken = await client.exchangeCode(code, codeVerifier);
    const profile = accessToken ? await client.fetchProfile(accessToken) : null;
    if (!profile) {
      return c.redirect(loginFailedUrl);
    }

    const userRepo = new D1UserRepository(createDb(c.env.DB));
    let user = await userRepo.findByXId(profile.id);
    if (!user) {
      const salt = AuthService.generateSalt();
      const passwordHash = await AuthService.hashPassword(crypto.randomUUID(), salt);
      user = User.create(
        `x-${profile.id}@x.meetu.internal`,
        passwordHash,
        salt,
        profile.name,
        profile.profileImageUrl,
        profile.id,
      );
      await userRepo.save(user);
    }

    if (user.isSuspended()) {
      return c.redirect(`${frontendUrl(c)}/login?error=account_suspended`);
    }

    const authService = new AuthService(c.env.CACHE_KV, c.env.JWT_SECRET);
    const tokens = await authService.createTokenPair(user.id, user.email);
    setRefreshCookie(c, tokens.refreshToken);

    return c.redirect(frontendUrl(c));
  });
