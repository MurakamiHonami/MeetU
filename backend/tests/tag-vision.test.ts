import { describe, expect, it } from "vitest";
import { parseVisionTagJson } from "../src/infrastructure/ai/TagVisionService";

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

  it("unwraps JSON Mode { response: object }", () => {
    const result = parseVisionTagJson({
      response: {
        tags: [{ name: "缶バッジ", category: "item" }],
        titleHint: "缶バッジ",
      },
    });
    expect(result.tags[0].name).toBe("缶バッジ");
    expect(result.titleHint).toBe("缶バッジ");
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
