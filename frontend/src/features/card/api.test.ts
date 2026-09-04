import { beforeEach, describe, expect, it, vi } from "vitest";

const call = vi.fn();

vi.mock("../../shared/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../shared/api")>();
  // vi.mock はホイストされるので、ヘルパーはファクトリ内で定義する
  const route = (name: string) => ({
    $post: (...a: unknown[]) => call(`${name}.post`, ...a),
    $get: (...a: unknown[]) => call(`${name}.get`, ...a),
    $delete: (...a: unknown[]) => call(`${name}.delete`, ...a),
  });
  return {
    ...actual,
    client: {
      api: {
        cards: {
          ...route("cards"),
          mine: route("cards.mine"),
          ":id": {
            ...route("cards.byId"),
            matches: route("cards.byId.matches"),
            "respond-options": route("cards.byId.respondOptions"),
            respond: route("cards.byId.respond"),
          },
        },
      },
    },
  };
});

import { cardApi } from "./api";

const ok = (body: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });
const fail = (status: number, body: unknown) => ({
  ok: false,
  status,
  json: () => Promise.resolve(body),
});

beforeEach(() => vi.clearAllMocks());

describe("createCard", () => {
  const base = {
    type: "GIVE" as const,
    title: "アクスタ譲ります",
    tags: [{ name: "推しA", category: "character" }],
    minMatchCount: 1,
  };

  it("maps tag names to the server's displayName field", async () => {
    call.mockResolvedValue(ok({ card: {}, newMatches: [], newGroups: [] }));

    await cardApi.createCard(base);

    expect(call.mock.calls[0][1].json.tags).toEqual([
      { displayName: "推しA", category: "character" },
    ]);
  });

  it("flattens requiredTags to bare names", async () => {
    call.mockResolvedValue(ok({ card: {}, newMatches: [], newGroups: [] }));

    await cardApi.createCard({ ...base, requiredTags: [{ name: "推しA" }, { name: "推しB" }] });

    expect(call.mock.calls[0][1].json.requiredTags).toEqual(["推しA", "推しB"]);
  });

  it("leaves requiredTags undefined when none are given", async () => {
    call.mockResolvedValue(ok({ card: {}, newMatches: [], newGroups: [] }));

    await cardApi.createCard(base);

    expect(call.mock.calls[0][1].json.requiredTags).toBeUndefined();
  });

  it("converts a null location to undefined so it is omitted", async () => {
    call.mockResolvedValue(ok({ card: {}, newMatches: [], newGroups: [] }));

    await cardApi.createCard({ ...base, location: null });

    expect(call.mock.calls[0][1].json.location).toBeUndefined();
  });

  it("passes a real location through unchanged", async () => {
    call.mockResolvedValue(ok({ card: {}, newMatches: [], newGroups: [] }));
    const location = { lat: 35.68, lon: 139.76 };

    await cardApi.createCard({ ...base, location });

    expect(call.mock.calls[0][1].json.location).toEqual(location);
  });

  it("returns the created card along with new matches and groups", async () => {
    const body = { card: { cardId: "c1" }, newMatches: [{ matchId: "m1" }], newGroups: [] };
    call.mockResolvedValue(ok(body));

    await expect(cardApi.createCard(base)).resolves.toEqual(body);
  });

  it("throws when the server rejects the card", async () => {
    call.mockResolvedValue(fail(400, { message: "タイトルが必要です" }));

    await expect(cardApi.createCard(base)).rejects.toThrow("タイトルが必要です");
  });
});

describe("simple card reads", () => {
  it("fetches my cards", async () => {
    call.mockResolvedValue(ok({ cards: [{ cardId: "c1" }] }));

    await expect(cardApi.myCards()).resolves.toEqual({ cards: [{ cardId: "c1" }] });
    expect(call).toHaveBeenCalledWith("cards.mine.get");
  });

  it("fetches a single card by id", async () => {
    call.mockResolvedValue(ok({ card: { cardId: "c1" } }));

    await cardApi.card("c1");
    expect(call).toHaveBeenCalledWith("cards.byId.get", { param: { id: "c1" } });
  });

  it("closes a card by id", async () => {
    call.mockResolvedValue(ok({ card: { cardId: "c1", status: "CLOSED" } }));

    await cardApi.closeCard("c1");
    expect(call).toHaveBeenCalledWith("cards.byId.delete", { param: { id: "c1" } });
  });

  it("fetches the candidate matches for a card", async () => {
    call.mockResolvedValue(ok({ cards: [], minMatchCount: 2 }));

    await expect(cardApi.cardMatches("c1")).resolves.toEqual({ cards: [], minMatchCount: 2 });
    expect(call).toHaveBeenCalledWith("cards.byId.matches.get", { param: { id: "c1" } });
  });

  it("throws a not-found error for a missing card", async () => {
    call.mockResolvedValue(fail(404, { message: "カードが見つかりません" }));

    await expect(cardApi.card("nope")).rejects.toThrow("カードが見つかりません");
  });
});

describe("search", () => {
  it("joins tags with commas and stringifies minMatch", async () => {
    call.mockResolvedValue(ok({ cards: [] }));

    await cardApi.search({ tags: ["推しA", "推しB"], minMatch: 2 });

    expect(call).toHaveBeenCalledWith("cards.get", {
      query: { tags: "推しA,推しB", minMatch: "2" },
    });
  });

  it("includes the type filter when one is selected", async () => {
    call.mockResolvedValue(ok({ cards: [] }));

    await cardApi.search({ tags: [], type: "WANT", minMatch: 1 });

    expect(call.mock.calls[0][1].query.type).toBe("WANT");
  });

  it("omits the type filter when it is an empty string", async () => {
    call.mockResolvedValue(ok({ cards: [] }));

    await cardApi.search({ tags: [], type: "", minMatch: 1 });

    expect(call.mock.calls[0][1].query).not.toHaveProperty("type");
  });

  it("sends an empty tags string when no tags are given", async () => {
    call.mockResolvedValue(ok({ cards: [] }));

    await cardApi.search({ tags: [], minMatch: 1 });

    expect(call.mock.calls[0][1].query.tags).toBe("");
  });
});

describe("respond", () => {
  it("fetches the respond options for a target card", async () => {
    call.mockResolvedValue(ok({ targetCard: {}, options: [] }));

    await cardApi.respondOptions("c1");
    expect(call).toHaveBeenCalledWith("cards.byId.respondOptions.get", { param: { id: "c1" } });
  });

  it("posts my card id against the target card", async () => {
    call.mockResolvedValue(ok({ created: true, match: { matchId: "m1" } }));

    await expect(cardApi.respond("target", "mine")).resolves.toEqual({
      created: true,
      match: { matchId: "m1" },
    });
    expect(call).toHaveBeenCalledWith("cards.byId.respond.post", {
      param: { id: "target" },
      json: { myCardId: "mine" },
    });
  });

  it("throws when responding is not allowed", async () => {
    call.mockResolvedValue(fail(403, { message: "この募集には応答できません" }));

    await expect(cardApi.respond("target", "mine")).rejects.toThrow("この募集には応答できません");
  });
});
