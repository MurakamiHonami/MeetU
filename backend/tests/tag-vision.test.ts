import { describe, expect, it } from "vitest";
import {
  extractToolCalls,
  formatSearchHits,
  parseSearchQuery,
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

  it("unwraps OpenAI-style choices content", () => {
    const result = parseVisionTagJson({
      choices: [
        {
          message: {
            content: { tags: [{ name: "天馬司", category: "character" }] },
          },
        },
      ],
    });
    expect(result.tags[0].name).toBe("天馬司");
  });

  it("parses JSON string in OpenAI choices content", () => {
    const result = parseVisionTagJson({
      choices: [
        {
          message: {
            content: '{"tags":[{"name":"五条悟","category":"character"}]}',
          },
        },
      ],
    });
    expect(result.tags[0].name).toBe("五条悟");
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

describe("extractToolCalls", () => {
  it("reads OpenAI tool_calls", () => {
    const calls = extractToolCalls({
      choices: [
        {
          message: {
            tool_calls: [
              {
                id: "c1",
                type: "function",
                function: { name: "web_search", arguments: '{"query":"天馬司"}' },
              },
            ],
          },
        },
      ],
    });
    expect(calls).toEqual([{ id: "c1", name: "web_search", arguments: '{"query":"天馬司"}' }]);
  });

  it("ignores unrelated tools", () => {
    expect(
      extractToolCalls({
        choices: [
          {
            message: {
              tool_calls: [
                { id: "x", type: "function", function: { name: "other", arguments: "{}" } },
              ],
            },
          },
        ],
      }),
    ).toEqual([]);
  });
});

describe("parseSearchQuery", () => {
  it("reads query from JSON arguments", () => {
    expect(parseSearchQuery('{"query":"プロセカ 水色の髪"}')).toBe("プロセカ 水色の髪");
  });
});

describe("formatSearchHits", () => {
  it("renders titles for the model", () => {
    expect(
      formatSearchHits([{ title: "天馬司", url: "https://example.com", description: "プロセカ" }]),
    ).toContain("天馬司");
  });

  it("says 検索結果なし when empty", () => {
    expect(formatSearchHits([])).toBe("検索結果なし");
  });
});
