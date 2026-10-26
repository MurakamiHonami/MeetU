import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { migrateToLatest } from "../src/infrastructure/db/migrate";
import app from "../src/index";
import { R2UploadService } from "../src/infrastructure/storage/R2UploadService";

function tokenFromUploadUrl(uploadUrl: string): string {
  return new URL(uploadUrl).searchParams.get("token")!;
}

function streamOf(bytes: number): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes));
      controller.close();
    },
  });
}

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

  it("rejects mock_ token when APP_ENV is unset (fail-closed, not fail-open)", async () => {
    const unsetEnv = { ...env, APP_ENV: undefined };
    const res = await app.request(
      "/api/me",
      {
        headers: { Authorization: "Bearer mock_attacker" },
      },
      unsetEnv,
    );

    expect(res.status).toBe(401);
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

  it("POST /api/reviews rejects invalid rating", async () => {
    const signupRes = await app.request(
      "/api/auth/signup",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "reviewtest@example.com",
          password: "password123",
          displayName: "Review Test",
        }),
      },
      env,
    );
    const signupData = (await signupRes.json()) as { tokens: { accessToken: string } };

    const res = await app.request(
      "/api/reviews",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${signupData.tokens.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ matchId: "fake", rating: 10 }),
      },
      env,
    );

    expect(res.status).toBe(400);
  });

  it("GET /api/nearby rejects missing coordinates", async () => {
    const signupRes = await app.request(
      "/api/auth/signup",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "nearbytest@example.com",
          password: "password123",
          displayName: "Nearby Test",
        }),
      },
      env,
    );
    const signupData = (await signupRes.json()) as { tokens: { accessToken: string } };

    const res = await app.request(
      "/api/nearby",
      {
        headers: { Authorization: `Bearer ${signupData.tokens.accessToken}` },
      },
      env,
    );

    expect(res.status).toBe(400);
  });

  it("GET /api/tags returns tag list without auth", async () => {
    const res = await app.request("/api/tags", {}, env);
    expect(res.status).toBe(401);
  });

  describe("upload size enforcement (#183)", () => {
    it("rejects a PUT body larger than the declared ticket size, even without Content-Length", async () => {
      const service = new R2UploadService(env.UPLOADS_R2, env.CACHE_KV, "http://localhost");
      const ticket = await service.createUploadTicket(
        "chat/thread-1/oversized.jpg",
        "image/jpeg",
        10,
      );
      const token = tokenFromUploadUrl(ticket.uploadUrl);

      await expect(service.handlePut(token, streamOf(20), null)).rejects.toThrow(
        "画像は 5MB 以内にしてください",
      );

      expect(await env.UPLOADS_R2.get("chat/thread-1/oversized.jpg")).toBeNull();
    });

    it("rejects a PUT whose Content-Length exceeds the declared ticket size before reading the body", async () => {
      const service = new R2UploadService(env.UPLOADS_R2, env.CACHE_KV, "http://localhost");
      const ticket = await service.createUploadTicket("chat/thread-1/lied.jpg", "image/jpeg", 10);
      const token = tokenFromUploadUrl(ticket.uploadUrl);

      await expect(service.handlePut(token, streamOf(10), 999)).rejects.toThrow(
        "画像は 5MB 以内にしてください",
      );

      expect(await env.UPLOADS_R2.get("chat/thread-1/lied.jpg")).toBeNull();
    });

    it("accepts a PUT body within the declared ticket size", async () => {
      const service = new R2UploadService(env.UPLOADS_R2, env.CACHE_KV, "http://localhost");
      const ticket = await service.createUploadTicket("chat/thread-1/ok.jpg", "image/jpeg", 10);
      const token = tokenFromUploadUrl(ticket.uploadUrl);

      await service.handlePut(token, streamOf(10), 10);

      expect(await env.UPLOADS_R2.get("chat/thread-1/ok.jpg")).not.toBeNull();
    });

    it("POST /api/uploads requires size", async () => {
      const signupRes = await app.request(
        "/api/auth/signup",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "uploadtest@example.com",
            password: "password123",
            displayName: "Upload Test",
          }),
        },
        env,
      );
      const signupData = (await signupRes.json()) as { tokens: { accessToken: string } };

      const res = await app.request(
        "/api/uploads",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${signupData.tokens.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ matchId: "fake", contentType: "image/jpeg" }),
        },
        env,
      );

      expect(res.status).toBe(400);
    });
  });
});
