import { beforeEach, describe, expect, it, vi } from "vitest";

const call = vi.fn();

vi.mock("../../shared/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../shared/api")>();
  return {
    ...actual,
    client: {
      api: {
        reviews: { $post: (...a: unknown[]) => call("reviews", ...a) },
        reports: { $post: (...a: unknown[]) => call("reports", ...a) },
      },
    },
  };
});

import { reviewApi } from "./api";

const ok = (body: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });
const fail = (status: number, body: unknown) => ({
  ok: false,
  status,
  json: () => Promise.resolve(body),
});

beforeEach(() => vi.clearAllMocks());

describe("review", () => {
  it("posts the rating for a match", async () => {
    call.mockResolvedValue(ok({ review: {} }));

    await reviewApi.review({ matchId: "m1", rating: 5 });

    expect(call).toHaveBeenCalledWith("reviews", { json: { matchId: "m1", rating: 5 } });
  });

  it("includes an optional comment", async () => {
    call.mockResolvedValue(ok({ review: {} }));

    await reviewApi.review({ matchId: "m1", rating: 4, comment: "ありがとうございました" });

    expect(call.mock.calls[0][1].json.comment).toBe("ありがとうございました");
  });

  it("throws when the match cannot be reviewed", async () => {
    call.mockResolvedValue(fail(409, { message: "すでに評価済みです" }));

    await expect(reviewApi.review({ matchId: "m1", rating: 5 })).rejects.toThrow(
      "すでに評価済みです",
    );
  });
});

describe("report", () => {
  it("posts a report with the reason", async () => {
    call.mockResolvedValue(ok({ reportId: "r1", message: "受け付けました" }));

    await expect(reviewApi.report({ targetUserId: "u2", reason: "HARASSMENT" })).resolves.toEqual({
      reportId: "r1",
      message: "受け付けました",
    });
    expect(call).toHaveBeenCalledWith("reports", {
      json: { targetUserId: "u2", reason: "HARASSMENT" },
    });
  });

  it("includes the optional match id and detail", async () => {
    call.mockResolvedValue(ok({ reportId: "r1", message: "ok" }));

    await reviewApi.report({
      targetUserId: "u2",
      matchId: "m1",
      reason: "NOT_DELIVERED",
      detail: "品物が届きません",
    });

    expect(call.mock.calls[0][1].json).toMatchObject({
      matchId: "m1",
      detail: "品物が届きません",
    });
  });

  it("throws when the report is rejected", async () => {
    call.mockResolvedValue(fail(400, { message: "理由が不正です" }));

    await expect(reviewApi.report({ targetUserId: "u2", reason: "OTHER" })).rejects.toThrow(
      "理由が不正です",
    );
  });
});
