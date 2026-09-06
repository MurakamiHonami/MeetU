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

  it("unwraps Gemini candidates parts with thoughtSignature", () => {
    const result = parseVisionTagJson({
      candidates: [
        {
          content: {
            parts: [
              {
                text: '{"tags":[{"name":"缶バッジ","category":"item"}]}',
                thoughtSignature: "opaque",
              },
            ],
          },
        },
      ],
    });
    expect(result.tags[0].name).toBe("缶バッジ");
  });

  it("unwraps REST { result: { choices } } envelope", () => {
    const result = parseVisionTagJson({
      success: true,
      result: {
        choices: [
          {
            message: {
              content: '{"tags":[{"name":"缶バッジ","category":"item"}]}',
            },
          },
        ],
      },
    });
    expect(result.tags[0].name).toBe("缶バッジ");
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

  it("strips think blocks around JSON", () => {
    const result = parseVisionTagJson({
      choices: [
        {
          message: {
            content:
              '<think>見た目を考える</think>\n{"tags":[{"name":"缶バッジ","category":"item"}]}',
          },
        },
      ],
    });
    expect(result.tags[0].name).toBe("缶バッジ");
  });

  it("joins content part arrays", () => {
    const result = parseVisionTagJson({
      choices: [
        {
          message: {
            content: [
              { type: "text", text: '{"tags":[{"name":"アクリルスタンド","category":"item"}]}' },
            ],
          },
        },
      ],
    });
    expect(result.tags[0].name).toBe("アクリルスタンド");
  });

  it("extracts JSON object buried in prose", () => {
    const result = parseVisionTagJson({
      response: 'Sure.\n{"tags":[{"name":"机","category":"item"}]}\n',
    });
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
