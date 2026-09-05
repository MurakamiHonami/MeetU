import { describe, expect, it } from "vitest";
import {
  extractVisionPayload,
  parseVisionTagJson,
} from "../src/infrastructure/ai/TagVisionService";

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

  it("deduplicates tags case-insensitively", () => {
    const result = parseVisionTagJson({
      tags: [
        { name: "プロセカ", category: "work" },
        { name: "プロセカ", category: "work" },
      ],
    });
    expect(result.tags).toHaveLength(1);
  });

  it("falls back unknown categories to other", () => {
    const result = parseVisionTagJson({
      tags: [{ name: "缶バッジ", category: "unknown" }],
    });
    expect(result.tags[0].category).toBe("other");
  });

  it("throws when no tags found", () => {
    expect(() => parseVisionTagJson({ tags: [] })).toThrow("画像からタグを読み取れませんでした");
  });
});

describe("extractVisionPayload", () => {
  it("accepts structured tags object (json_schema direct return)", () => {
    const payload = extractVisionPayload({
      tags: [{ name: "アクスタ", category: "item" }],
    });
    expect(payload).toEqual({ tags: [{ name: "アクスタ", category: "item" }] });
  });

  it("parses classic { response: string } envelope", () => {
    const payload = extractVisionPayload({
      response: '{"tags":[{"name":"缶バッジ","category":"item"}]}',
    });
    expect(payload).toEqual({ tags: [{ name: "缶バッジ", category: "item" }] });
  });

  it("accepts { response: object } (Workers AI vision JSON mode)", () => {
    const payload = extractVisionPayload({
      response: {
        tags: [{ name: "Acrylic Stand", category: "item" }],
        titleHint: "アクスタ",
      },
    });
    expect(payload).toEqual({
      tags: [{ name: "Acrylic Stand", category: "item" }],
      titleHint: "アクスタ",
    });
  });

  it("parses { result: { response } } envelope with string", () => {
    const payload = extractVisionPayload({
      result: { response: '{"tags":[{"name":"イベント","category":"event"}]}' },
    });
    expect(payload).toEqual({ tags: [{ name: "イベント", category: "event" }] });
  });

  it("parses { result: { response: object } } REST envelope", () => {
    const payload = extractVisionPayload({
      success: true,
      result: {
        response: { tags: [{ name: "アクスタ", category: "item" }] },
      },
    });
    expect(payload).toEqual({ tags: [{ name: "アクスタ", category: "item" }] });
  });

  it("strips markdown fences around JSON", () => {
    const payload = extractVisionPayload({
      response: '```json\n{"tags":[{"name":"作品","category":"work"}]}\n```',
    });
    expect(payload).toEqual({ tags: [{ name: "作品", category: "work" }] });
  });

  it("extracts JSON object buried in prose", () => {
    const payload = extractVisionPayload({
      response:
        'Based on the image:\n\n{"tags":[{"name":"缶バッジ","category":"item"}]}\n\nThat is all.',
    });
    expect(payload).toEqual({ tags: [{ name: "缶バッジ", category: "item" }] });
  });

  it("throws 画像解析に失敗しました when response text is missing", () => {
    expect(() => extractVisionPayload({ success: false, errors: [] })).toThrow(
      "画像解析に失敗しました",
    );
  });
});
