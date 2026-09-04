import { beforeEach, describe, expect, it, vi } from "vitest";

const call = vi.fn();

vi.mock("../../shared/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../shared/api")>();
  return {
    ...actual,
    client: {
      api: {
        feed: {
          $get: (...a: unknown[]) => call("feed.get", ...a),
          ":cardId": {
            save: { $post: (...a: unknown[]) => call("feed.save", ...a) },
            skip: { $post: (...a: unknown[]) => call("feed.skip", ...a) },
          },
        },
        saved: {
          $get: (...a: unknown[]) => call("saved.get", ...a),
          ":cardId": { $delete: (...a: unknown[]) => call("saved.delete", ...a) },
        },
      },
    },
  };
});

import { feedApi } from "./api";

const ok = (body: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });
const fail = (status: number, body: unknown) => ({
  ok: false,
  status,
  json: () => Promise.resolve(body),
});

beforeEach(() => vi.clearAllMocks());

describe("feedApi", () => {
  it("returns the feed cards and the favorites flag", async () => {
    call.mockResolvedValue(ok({ cards: [{ cardId: "c1" }], hasFavorites: true }));

    await expect(feedApi.feed()).resolves.toEqual({
      cards: [{ cardId: "c1" }],
      hasFavorites: true,
    });
  });

  it("reports an empty feed without favorites", async () => {
    call.mockResolvedValue(ok({ cards: [], hasFavorites: false }));

    const res = await feedApi.feed();
    expect(res.cards).toEqual([]);
    expect(res.hasFavorites).toBe(false);
  });

  it("saves a card by id", async () => {
    call.mockResolvedValue(ok({ cardId: "c1" }));

    await expect(feedApi.saveCard("c1")).resolves.toEqual({ cardId: "c1" });
    expect(call).toHaveBeenCalledWith("feed.save", { param: { cardId: "c1" } });
  });

  it("skips a card by id", async () => {
    call.mockResolvedValue(ok({ cardId: "c1" }));

    await feedApi.skipCard("c1");
    expect(call).toHaveBeenCalledWith("feed.skip", { param: { cardId: "c1" } });
  });

  it("lists the saved cards", async () => {
    call.mockResolvedValue(ok({ cards: [{ cardId: "c2" }] }));

    await expect(feedApi.savedCards()).resolves.toEqual({ cards: [{ cardId: "c2" }] });
    expect(call).toHaveBeenCalledWith("saved.get");
  });

  it("unsaves a card by id", async () => {
    call.mockResolvedValue(ok({ cardId: "c2" }));

    await feedApi.unsaveCard("c2");
    expect(call).toHaveBeenCalledWith("saved.delete", { param: { cardId: "c2" } });
  });

  it("throws when saving a card the server rejects", async () => {
    call.mockResolvedValue(fail(404, { message: "カードが見つかりません" }));

    await expect(feedApi.saveCard("gone")).rejects.toThrow("カードが見つかりません");
  });

  it("throws when the feed request fails", async () => {
    call.mockResolvedValue(fail(500, {}));

    await expect(feedApi.feed()).rejects.toThrow("リクエストに失敗しました (500)");
  });
});
