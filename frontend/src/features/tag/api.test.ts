import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
const authenticatedFetch = vi.fn();

vi.mock("../../shared/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../shared/api")>();
  return {
    ...actual,
    authenticatedFetch: (...a: unknown[]) => authenticatedFetch(...a),
    client: { api: { tags: { $get: (...a: unknown[]) => get(...a) } } },
  };
});

import { tagApi } from "./api";

const ok = (body: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });
const fail = (status: number, body: unknown) => ({
  ok: false,
  status,
  json: () => Promise.resolve(body),
});

beforeEach(() => vi.clearAllMocks());

describe("suggestTags", () => {
  it("passes the query through to the tags endpoint", async () => {
    get.mockResolvedValue(ok({ tags: [] }));

    await tagApi.suggestTags("推し");
    expect(get).toHaveBeenCalledWith({ query: { q: "推し" } });
  });

  it("returns the matching tags", async () => {
    get.mockResolvedValue(ok({ tags: [{ tagId: "t1", name: "推しA", useCount: 3 }] }));

    const res = await tagApi.suggestTags("推し");
    expect(res.tags).toHaveLength(1);
    expect(res.tags[0].name).toBe("推しA");
  });

  it("surfaces the create candidate for an unknown tag", async () => {
    get.mockResolvedValue(
      ok({ tags: [], createCandidate: { tagId: "new", name: "新タグ", isNew: true } }),
    );

    const res = await tagApi.suggestTags("新タグ");
    expect(res.createCandidate?.isNew).toBe(true);
  });

  it("throws when the suggestion request fails", async () => {
    get.mockResolvedValue(fail(500, {}));

    await expect(tagApi.suggestTags("推し")).rejects.toThrow("リクエストに失敗しました (500)");
  });
});

describe("inferTagsFromImage", () => {
  const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });

  it("POSTs the image as multipart form data", async () => {
    authenticatedFetch.mockResolvedValue(ok({ tags: [] }));

    await tagApi.inferTagsFromImage(file);

    const [url, init] = authenticatedFetch.mock.calls[0];
    expect(url).toContain("/api/tags/infer-image");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("image")).toBe(file);
  });

  it("sets no Content-Type so the browser can add the multipart boundary", async () => {
    authenticatedFetch.mockResolvedValue(ok({ tags: [] }));

    await tagApi.inferTagsFromImage(file);

    expect(authenticatedFetch.mock.calls[0][1].headers).toBeUndefined();
  });

  it("returns the inferred tags and the title hint", async () => {
    authenticatedFetch.mockResolvedValue(
      ok({
        tags: [{ tagId: "t1", name: "アクスタ", isNew: false }],
        titleHint: "アクスタ譲ります",
      }),
    );

    const res = await tagApi.inferTagsFromImage(file);
    expect(res.tags[0].name).toBe("アクスタ");
    expect(res.titleHint).toBe("アクスタ譲ります");
  });

  it("throws with the server message when inference fails", async () => {
    authenticatedFetch.mockResolvedValue(fail(422, { message: "画像を解析できませんでした" }));

    await expect(tagApi.inferTagsFromImage(file)).rejects.toThrow("画像を解析できませんでした");
  });
});
