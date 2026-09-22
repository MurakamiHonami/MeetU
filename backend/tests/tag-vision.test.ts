import { afterEach, describe, expect, it, vi } from "vitest";
import { parseVisionTagJson, TagVisionService } from "../src/infrastructure/ai/TagVisionService";

// @google/genai は内部で `fetch` を叩く。レスポンスは実際の Gemini REST API と同じ形（
// `candidates[].content.parts[].text` / `{ error: { message } }`）なので、そのままモックできる。
function geminiOkResponse(tags: { name: string; category: string }[]): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ tags }) }] } }],
    }),
  } as unknown as Response;
}

function geminiErrorResponse(status: number, message: string): Response {
  return {
    ok: false,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({ error: { message } }),
    text: async () => JSON.stringify({ error: { message } }),
  } as unknown as Response;
}

describe("parseVisionTagJson", () => {
  it("parses valid tag list", () => {
    const result = parseVisionTagJson({
      tags: [
        { name: "プロセカ", category: "work" },
        { name: "天馬司", category: "character" },
        { name: "アクスタ", category: "item" },
      ],
      titleHint: "天馬司アクスタ譲ります",
    });
    expect(result.tags).toHaveLength(3);
    expect(result.tags[0].name).toBe("プロセカ");
    expect(result.titleHint).toBe("天馬司アクスタ譲ります");
  });

  it("parses a JSON string, as returned by GenerateContentResponse.text", () => {
    const result = parseVisionTagJson('{"tags":[{"name":"缶バッジ","category":"item"}]}');
    expect(result.tags[0].name).toBe("缶バッジ");
  });

  it("strips think blocks around JSON", () => {
    const result = parseVisionTagJson(
      '<think>見た目を考える</think>\n{"tags":[{"name":"缶バッジ","category":"item"}]}',
    );
    expect(result.tags[0].name).toBe("缶バッジ");
  });

  it("extracts JSON object buried in prose", () => {
    const result = parseVisionTagJson('Sure.\n{"tags":[{"name":"机","category":"item"}]}\n');
    expect(result.tags[0].name).toBe("机");
  });

  it("deduplicates tags case-insensitively", () => {
    const result = parseVisionTagJson({
      tags: [
        { name: "プロセカ", category: "work" },
        { name: "プロセカ", category: "work" },
      ],
    });
    expect(result.tags).toHaveLength(1);
  });

  it("drops tags whose category is outside the schema enum", () => {
    expect(() => parseVisionTagJson({ tags: [{ name: "缶バッジ", category: "unknown" }] })).toThrow(
      "画像からタグを読み取れませんでした",
    );
  });

  it("throws when no tags found", () => {
    expect(() => parseVisionTagJson({ tags: [] })).toThrow("画像からタグを読み取れませんでした");
  });

  it("throws 画像解析に失敗しました when JSON Mode envelope is missing", () => {
    expect(() => parseVisionTagJson({ success: false, errors: [] })).toThrow(
      "画像解析に失敗しました",
    );
  });
});

describe("TagVisionService.inferFromImage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to the next model when the first is overloaded (503)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geminiErrorResponse(503, "high demand"))
      .mockResolvedValueOnce(geminiOkResponse([{ name: "缶バッジ", category: "item" }]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new TagVisionService("key").inferFromImage(
      new Uint8Array([1]),
      "image/png",
    );

    expect(result.tags[0].name).toBe("缶バッジ");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("gemini-3.6-flash:");
    expect(String(fetchMock.mock.calls[1][0])).toContain("gemini-3.6-flash-lite:");
  });

  it("falls back on rate limiting (429) too", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geminiErrorResponse(429, "rate limited"))
      .mockResolvedValueOnce(geminiOkResponse([{ name: "缶バッジ", category: "item" }]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new TagVisionService("key").inferFromImage(
      new Uint8Array([1]),
      "image/png",
    );

    expect(result.tags[0].name).toBe("缶バッジ");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not fall back on 403 (auth failure affects every model equally)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(geminiErrorResponse(403, "no access"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      new TagVisionService("key").inferFromImage(new Uint8Array([1]), "image/png"),
    ).rejects.toThrow("このビジョンモデルは現在利用できません");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces the last error when every model is overloaded", async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiErrorResponse(503, "high demand"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      new TagVisionService("key").inferFromImage(new Uint8Array([1]), "image/png"),
    ).rejects.toThrow("画像解析に失敗しました (503)");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
