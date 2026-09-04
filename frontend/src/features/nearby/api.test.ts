import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();

vi.mock("../../shared/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../shared/api")>();
  return {
    ...actual,
    client: { api: { nearby: { $get: (...a: unknown[]) => get(...a) } } },
  };
});

import { nearbyApi } from "./api";

const ok = (body: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });
const fail = (status: number, body: unknown) => ({
  ok: false,
  status,
  json: () => Promise.resolve(body),
});

beforeEach(() => vi.clearAllMocks());

describe("nearby", () => {
  const params = { lat: 35.68, lon: 139.76, radius: 5 };

  it("stringifies the coordinates and radius for the query string", async () => {
    get.mockResolvedValue(ok({ cards: [], center: params, radiusKm: 5 }));

    await nearbyApi.nearby(params);

    expect(get).toHaveBeenCalledWith({
      query: { lat: "35.68", lon: "139.76", radius: "5" },
    });
  });

  it("includes the type filter when one is selected", async () => {
    get.mockResolvedValue(ok({ cards: [], center: params, radiusKm: 5 }));

    await nearbyApi.nearby({ ...params, type: "GIVE" });

    expect(get.mock.calls[0][0].query.type).toBe("GIVE");
  });

  it("omits the type filter when it is an empty string", async () => {
    get.mockResolvedValue(ok({ cards: [], center: params, radiusKm: 5 }));

    await nearbyApi.nearby({ ...params, type: "" });

    expect(get.mock.calls[0][0].query).not.toHaveProperty("type");
  });

  it("handles negative coordinates", async () => {
    get.mockResolvedValue(ok({ cards: [], center: params, radiusKm: 5 }));

    await nearbyApi.nearby({ lat: -33.86, lon: -151.2, radius: 1 });

    expect(get.mock.calls[0][0].query).toMatchObject({ lat: "-33.86", lon: "-151.2" });
  });

  it("returns the cards with the resolved center and radius", async () => {
    const body = { cards: [{ cardId: "c1" }], center: { lat: 35.68, lon: 139.76 }, radiusKm: 5 };
    get.mockResolvedValue(ok(body));

    await expect(nearbyApi.nearby(params)).resolves.toEqual(body);
  });

  it("throws when the server rejects the coordinates", async () => {
    get.mockResolvedValue(fail(400, { message: "座標が不正です" }));

    await expect(nearbyApi.nearby(params)).rejects.toThrow("座標が不正です");
  });
});
