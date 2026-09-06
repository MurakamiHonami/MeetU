import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { env } from "cloudflare:test";
import { migrateToLatest } from "../src/infrastructure/db/migrate";
import app from "../src/index";
import { REFRESH_COOKIE } from "../src/interfaces/auth/cookies";

function readRefreshCookie(res: Response): string | undefined {
  const header = res.headers.get("Set-Cookie");
  if (!header) return undefined;
  const match = header.match(new RegExp(`${REFRESH_COOKIE}=([^;]+)`));
  return match?.[1];
}

function stubXFetch(options: {
  tokenOk?: boolean;
  profile?: { id: string; name: string; profile_image_url?: string } | null;
}) {
  const { tokenOk = true, profile = { id: "x-user-1", name: "推し活たかし" } } = options;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("https://api.twitter.com/2/oauth2/token")) {
      return tokenOk
        ? new Response(JSON.stringify({ access_token: "x-access-token" }), { status: 200 })
        : new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
    }
    if (url.startsWith("https://api.twitter.com/2/users/me")) {
      return profile
        ? new Response(JSON.stringify({ data: profile }), { status: 200 })
        : new Response(JSON.stringify({ error: "not found" }), { status: 500 });
    }
    throw new Error(`unexpected fetch in test: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function startXLogin(): Promise<string> {
  const loginRes = await app.request("/api/auth/x/login", {}, env);
  expect(loginRes.status).toBe(302);
  const location = new URL(loginRes.headers.get("Location")!);
  return location.searchParams.get("state")!;
}

describe("Web App Auth & API Integration Tests", () => {
  beforeEach(async () => {
    await migrateToLatest(env.DB);
  });

  it("GET /health returns 200 OK", async () => {
    const res = await app.request("/health", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok", runtime: "Cloudflare Workers (TypeScript)" });
  });

  it("Auth Flow: Signup, Login, Refresh (KV + Cookie), Protected Route", async () => {
    const signupRes = await app.request(
      "/api/auth/signup",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
          displayName: "テストユーザー",
        }),
      },
      env,
    );

    expect(signupRes.status).toBe(201);
    const signupData = (await signupRes.json()) as any;
    expect(signupData.user.email).toBe("test@example.com");
    expect(signupData.tokens.accessToken).toBeDefined();
    expect(signupData.tokens.refreshToken).toBeUndefined();

    const oldRefreshToken = readRefreshCookie(signupRes);
    expect(oldRefreshToken).toBeDefined();

    const storedKV = await env.CACHE_KV.get(`refresh:${oldRefreshToken}`);
    expect(storedKV).not.toBeNull();

    const meRes = await app.request(
      "/api/me",
      {
        headers: { Authorization: `Bearer ${signupData.tokens.accessToken}` },
      },
      env,
    );

    expect(meRes.status).toBe(200);
    const meData = (await meRes.json()) as any;
    expect(meData.user.displayName).toBe("テストユーザー");

    const refreshRes = await app.request(
      "/api/auth/refresh",
      {
        method: "POST",
        headers: { Cookie: `${REFRESH_COOKIE}=${oldRefreshToken}` },
      },
      env,
    );

    expect(refreshRes.status).toBe(200);
    const refreshData = (await refreshRes.json()) as any;
    expect(refreshData.tokens.accessToken).toBeDefined();
    expect(refreshData.tokens.refreshToken).toBeUndefined();

    const newRefreshToken = readRefreshCookie(refreshRes);
    expect(newRefreshToken).toBeDefined();
    expect(newRefreshToken).not.toBe(oldRefreshToken);

    const revokedKV = await env.CACHE_KV.get(`refresh:${oldRefreshToken}`);
    expect(revokedKV).toBeNull();

    const newKV = await env.CACHE_KV.get(`refresh:${newRefreshToken}`);
    expect(newKV).not.toBeNull();

    const logoutRes = await app.request(
      "/api/auth/logout",
      {
        method: "POST",
        headers: { Cookie: `${REFRESH_COOKIE}=${newRefreshToken}` },
      },
      env,
    );

    expect(logoutRes.status).toBe(200);
    const loggedOutKV = await env.CACHE_KV.get(`refresh:${newRefreshToken}`);
    expect(loggedOutKV).toBeNull();
  });

  it("POST /api/cards creates card and triggers matching with Access Token", async () => {
    const user1Res = await app.request(
      "/api/auth/signup",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "user1@example.com",
          password: "password",
          displayName: "ユーザー1",
        }),
      },
      env,
    );
    const user1Data = (await user1Res.json()) as any;

    const user2Res = await app.request(
      "/api/auth/signup",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "user2@example.com",
          password: "password",
          displayName: "ユーザー2",
        }),
      },
      env,
    );
    const user2Data = (await user2Res.json()) as any;

    await app.request(
      "/api/cards",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user1Data.tokens.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "GIVE",
          title: "司アクスタ譲ります",
          minMatchCount: 2,
          tags: [
            { displayName: "プロセカ" },
            { displayName: "天馬司" },
            { displayName: "アクスタ" },
          ],
        }),
      },
      env,
    );

    const card2Res = await app.request(
      "/api/cards",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user2Data.tokens.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "WANT",
          title: "司アクスタ求めます",
          minMatchCount: 2,
          tags: [
            { displayName: "プロセカ" },
            { displayName: "天馬司" },
            { displayName: "缶バッジ" },
          ],
        }),
      },
      env,
    );

    expect(card2Res.status).toBe(201);

    const matchRes = await app.request(
      "/api/matches",
      {
        headers: { Authorization: `Bearer ${user1Data.tokens.accessToken}` },
      },
      env,
    );

    expect(matchRes.status).toBe(200);
    const matchData = (await matchRes.json()) as any;
    expect(matchData.matches.length).toBe(1);
    expect(matchData.matches[0].matchCount).toBe(2);
  });

  describe("X (Twitter) OAuth login", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("GET /api/auth/x/login redirects to X's authorization endpoint with a PKCE challenge", async () => {
      const loginRes = await app.request("/api/auth/x/login", {}, env);

      expect(loginRes.status).toBe(302);
      const location = new URL(loginRes.headers.get("Location")!);
      expect(location.origin + location.pathname).toBe("https://twitter.com/i/oauth2/authorize");
      expect(location.searchParams.get("client_id")).toBe(env.X_CLIENT_ID);
      expect(location.searchParams.get("redirect_uri")).toBe(env.X_REDIRECT_URI);
      expect(location.searchParams.get("code_challenge_method")).toBe("S256");
      expect(location.searchParams.get("code_challenge")).toBeTruthy();

      const state = location.searchParams.get("state")!;
      const storedVerifier = await env.CACHE_KV.get(`x_oauth_state:${state}`);
      expect(storedVerifier).not.toBeNull();
    });

    it("returns 503 when X OAuth credentials are not configured", async () => {
      const res = await app.request("/api/auth/x/login", {}, { ...env, X_CLIENT_ID: undefined });
      expect(res.status).toBe(503);
    });

    it("GET /api/auth/x/callback creates a new account from the X profile and logs the user in", async () => {
      const state = await startXLogin();
      stubXFetch({ profile: { id: "x-user-42", name: "推し活たかし" } });

      const callbackRes = await app.request(
        `/api/auth/x/callback?code=auth-code&state=${state}`,
        {},
        env,
      );

      expect(callbackRes.status).toBe(302);
      expect(callbackRes.headers.get("Location")).toBe(env.CORS_ORIGINS);

      const refreshToken = readRefreshCookie(callbackRes);
      expect(refreshToken).toBeDefined();

      // state は使い切りなので KV から削除されている
      expect(await env.CACHE_KV.get(`x_oauth_state:${state}`)).toBeNull();

      const refreshRes = await app.request(
        "/api/auth/refresh",
        { method: "POST", headers: { Cookie: `${REFRESH_COOKIE}=${refreshToken}` } },
        env,
      );
      const { tokens } = (await refreshRes.json()) as any;

      const meRes = await app.request(
        "/api/me",
        { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
        env,
      );
      const { user } = (await meRes.json()) as any;
      expect(user.displayName).toBe("推し活たかし");
    });

    it("logs the same user in again on a second visit instead of creating a duplicate account", async () => {
      const firstState = await startXLogin();
      stubXFetch({ profile: { id: "x-user-99", name: "推し活たかし" } });
      const firstCallback = await app.request(
        `/api/auth/x/callback?code=auth-code&state=${firstState}`,
        {},
        env,
      );
      const firstRefreshToken = readRefreshCookie(firstCallback);
      const firstAccessToken = (
        (await (
          await app.request(
            "/api/auth/refresh",
            { method: "POST", headers: { Cookie: `${REFRESH_COOKIE}=${firstRefreshToken}` } },
            env,
          )
        ).json()) as any
      ).tokens.accessToken;
      const firstUserId = (
        (await (
          await app.request(
            "/api/me",
            { headers: { Authorization: `Bearer ${firstAccessToken}` } },
            env,
          )
        ).json()) as any
      ).user.id;

      vi.unstubAllGlobals();
      const secondState = await startXLogin();
      stubXFetch({ profile: { id: "x-user-99", name: "推し活たかし（改名済み）" } });
      const secondCallback = await app.request(
        `/api/auth/x/callback?code=auth-code&state=${secondState}`,
        {},
        env,
      );
      const secondRefreshToken = readRefreshCookie(secondCallback);
      const secondAccessToken = (
        (await (
          await app.request(
            "/api/auth/refresh",
            { method: "POST", headers: { Cookie: `${REFRESH_COOKIE}=${secondRefreshToken}` } },
            env,
          )
        ).json()) as any
      ).tokens.accessToken;
      const secondUserId = (
        (await (
          await app.request(
            "/api/me",
            { headers: { Authorization: `Bearer ${secondAccessToken}` } },
            env,
          )
        ).json()) as any
      ).user.id;

      expect(secondUserId).toBe(firstUserId);
    });

    it("redirects to the login page with an error when X reports the user denied access", async () => {
      const res = await app.request(
        "/api/auth/x/callback?error=access_denied&state=whatever",
        {},
        env,
      );
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe(`${env.CORS_ORIGINS}/login?error=x_oauth_failed`);
    });

    it("redirects to the login page with an error when the state is unknown or expired", async () => {
      const res = await app.request(
        "/api/auth/x/callback?code=auth-code&state=never-issued",
        {},
        env,
      );
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe(`${env.CORS_ORIGINS}/login?error=x_oauth_failed`);
    });

    it("redirects to the login page with an error when the token exchange fails", async () => {
      const state = await startXLogin();
      stubXFetch({ tokenOk: false });

      const res = await app.request(`/api/auth/x/callback?code=auth-code&state=${state}`, {}, env);
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe(`${env.CORS_ORIGINS}/login?error=x_oauth_failed`);
    });
  });
});
