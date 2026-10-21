import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { migrateToLatest } from "../src/infrastructure/db/migrate";
import app from "../src/index";

async function signup(email: string): Promise<string> {
  const res = await app.request(
    "/api/auth/signup",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "password123", displayName: "読書家" }),
    },
    env,
  );
  expect(res.status).toBe(201);
  const data = (await res.json()) as any;
  return data.tokens.accessToken;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

describe("Reading list API", () => {
  beforeEach(async () => {
    await migrateToLatest(env.DB);
  });

  it("adds a book, lists it, and filters by status", async () => {
    const token = await signup("reader1@example.com");

    const addRes = await app.request(
      "/api/reading",
      {
        method: "POST",
        headers: auth(token),
        body: JSON.stringify({
          title: "リーダブルコード",
          author: "Dustin Boswell",
          isbn: "9784873115658",
        }),
      },
      env,
    );
    expect(addRes.status).toBe(200);
    const { item } = (await addRes.json()) as any;
    expect(item.status).toBe("UNREAD");
    expect(item.title).toBe("リーダブルコード");

    const listRes = await app.request("/api/reading", { headers: auth(token) }, env);
    const { items } = (await listRes.json()) as any;
    expect(items).toHaveLength(1);

    const emptyRes = await app.request("/api/reading?status=DONE", { headers: auth(token) }, env);
    const empty = (await emptyRes.json()) as any;
    expect(empty.items).toHaveLength(0);
  });

  it("rejects a duplicate ISBN for the same owner", async () => {
    const token = await signup("reader2@example.com");
    const body = JSON.stringify({ title: "達人プログラマー", isbn: "9784274226298" });
    const first = await app.request(
      "/api/reading",
      { method: "POST", headers: auth(token), body },
      env,
    );
    expect(first.status).toBe(200);
    const dup = await app.request(
      "/api/reading",
      { method: "POST", headers: auth(token), body },
      env,
    );
    expect(dup.status).toBe(409);
  });

  it("changes status and edits fields via PATCH", async () => {
    const token = await signup("reader3@example.com");
    const addRes = await app.request(
      "/api/reading",
      { method: "POST", headers: auth(token), body: JSON.stringify({ title: "SICP" }) },
      env,
    );
    const { item } = (await addRes.json()) as any;

    const patchRes = await app.request(
      `/api/reading/${item.id}`,
      {
        method: "PATCH",
        headers: auth(token),
        body: JSON.stringify({ status: "READING", note: "2章まで" }),
      },
      env,
    );
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as any;
    expect(patched.item.status).toBe("READING");
    expect(patched.item.note).toBe("2章まで");
  });

  it("forbids touching another user's book", async () => {
    const owner = await signup("owner@example.com");
    const other = await signup("intruder@example.com");
    const addRes = await app.request(
      "/api/reading",
      {
        method: "POST",
        headers: auth(owner),
        body: JSON.stringify({ title: "Clean Architecture" }),
      },
      env,
    );
    const { item } = (await addRes.json()) as any;

    const res = await app.request(
      `/api/reading/${item.id}`,
      { method: "PATCH", headers: auth(other), body: JSON.stringify({ status: "DONE" }) },
      env,
    );
    expect(res.status).toBe(403);
  });

  it("lists a book for trade, creating a GIVE card linked back to the item", async () => {
    const token = await signup("seller@example.com");
    const addRes = await app.request(
      "/api/reading",
      {
        method: "POST",
        headers: auth(token),
        body: JSON.stringify({ title: "プログラミングTypeScript", status: "DONE" }),
      },
      env,
    );
    const { item } = (await addRes.json()) as any;

    const tradeRes = await app.request(
      `/api/reading/${item.id}/list-for-trade`,
      {
        method: "POST",
        headers: auth(token),
        body: JSON.stringify({
          tags: [{ displayName: "TypeScript" }, { displayName: "プログラミング" }],
        }),
      },
      env,
    );
    expect(tradeRes.status).toBe(200);
    const trade = (await tradeRes.json()) as any;
    expect(trade.card.type).toBe("GIVE");
    expect(trade.card.title).toBe("プログラミングTypeScript");
    expect(trade.item.cardId).toBe(trade.card.id);

    // 二重出品は拒否
    const again = await app.request(
      `/api/reading/${item.id}/list-for-trade`,
      {
        method: "POST",
        headers: auth(token),
        body: JSON.stringify({ tags: [{ displayName: "TypeScript" }] }),
      },
      env,
    );
    expect(again.status).toBe(409);
  });
});
