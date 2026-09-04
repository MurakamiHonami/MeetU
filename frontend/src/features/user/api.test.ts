import { beforeEach, describe, expect, it, vi } from "vitest";

const call = vi.fn();

vi.mock("../../shared/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../shared/api")>();
  return {
    ...actual,
    client: {
      api: {
        me: {
          $get: (...a: unknown[]) => call("me.get", ...a),
          $put: (...a: unknown[]) => call("me.put", ...a),
          reviews: { $get: (...a: unknown[]) => call("me.reviews.get", ...a) },
        },
      },
    },
  };
});

import { userApi } from "./api";

const ok = (body: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });
const fail = (status: number, body: unknown) => ({
  ok: false,
  status,
  json: () => Promise.resolve(body),
});

beforeEach(() => vi.clearAllMocks());

describe("userApi", () => {
  it("returns the current user with the card count", async () => {
    call.mockResolvedValue(ok({ user: { userId: "u1", displayName: "あきら", cardCount: 3 } }));

    const res = await userApi.me();
    expect(res.user.cardCount).toBe(3);
    expect(call).toHaveBeenCalledWith("me.get");
  });

  it("returns my received reviews", async () => {
    call.mockResolvedValue(ok({ reviews: [{ rating: 5, createdAt: "2026-01-01T00:00:00Z" }] }));

    const res = await userApi.myReviews();
    expect(res.reviews[0].rating).toBe(5);
    expect(call).toHaveBeenCalledWith("me.reviews.get");
  });

  it("updates favorites via PUT", async () => {
    call.mockResolvedValue(ok({ user: { userId: "u1" } }));

    await userApi.updateFavorites([{ name: "推しA" }]);

    expect(call).toHaveBeenCalledWith("me.put", { json: { favorites: [{ name: "推しA" }] } });
  });

  it("clears favorites with an empty list", async () => {
    call.mockResolvedValue(ok({ user: { userId: "u1" } }));

    await userApi.updateFavorites([]);

    expect(call.mock.calls[0][1].json.favorites).toEqual([]);
  });

  it("updates the home location", async () => {
    call.mockResolvedValue(ok({ user: { userId: "u1" } }));
    const home = { lat: 35.68, lon: 139.76, name: "東京駅" };

    await userApi.updateHome(home);

    expect(call).toHaveBeenCalledWith("me.put", { json: { homeLocation: home } });
  });

  it("sends null to clear the home location", async () => {
    call.mockResolvedValue(ok({ user: { userId: "u1" } }));

    await userApi.updateHome(null);

    expect(call.mock.calls[0][1].json.homeLocation).toBeNull();
  });

  it("throws when the profile request is unauthorized", async () => {
    call.mockResolvedValue(fail(401, { message: "ログインが必要です" }));

    await expect(userApi.me()).rejects.toThrow("ログインが必要です");
  });
});
