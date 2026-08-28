import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { migrateToLatest } from "../src/infrastructure/db/migrate";
import app from "../src/index";

describe("Security & Validation", () => {
  beforeEach(async () => {
    await migrateToLatest(env.DB);
  });

  it("rejects mock_ token outside local environment", async () => {
    const stagingEnv = { ...env, APP_ENV: "staging" };
    const res = await app.request(
      "/api/me",
      {
        headers: { Authorization: "Bearer mock_attacker" },
      },
      stagingEnv,
    );

    expect(res.status).toBe(401);
  });

  it("allows mock_ token in local environment", async () => {
    const localEnv = { ...env, APP_ENV: "local" };
    const res = await app.request(
      "/api/me",
      {
        headers: { Authorization: "Bearer mock_local-user" },
      },
      localEnv,
    );

    expect(res.status).not.toBe(401);
  });

  it("POST /api/auth/signup rejects invalid email", async () => {
    const res = await app.request(
      "/api/auth/signup",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "not-an-email",
          password: "password123",
          displayName: "Test",
        }),
      },
      env,
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBeDefined();
  });

  it("POST /api/auth/signup rejects short password", async () => {
    const res = await app.request(
      "/api/auth/signup",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "valid@example.com",
          password: "short",
          displayName: "Test",
        }),
      },
      env,
    );

    expect(res.status).toBe(400);
  });

  it("POST /api/cards rejects empty tags", async () => {
    const signupRes = await app.request(
      "/api/auth/signup",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "cardtest@example.com",
          password: "password123",
          displayName: "Card Test",
        }),
      },
      env,
    );
    const signupData = (await signupRes.json()) as { tokens: { accessToken: string } };

    const res = await app.request(
      "/api/cards",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${signupData.tokens.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "GIVE",
          title: "Test card",
          tags: [],
        }),
      },
      env,
    );

    expect(res.status).toBe(400);
  });

  it("GET /api/tags returns tag list without auth", async () => {
    const res = await app.request("/api/tags", {}, env);
    expect(res.status).toBe(401);
  });
});
