import { ValidationError } from "../../domain/shared/DomainError";
import { TagNormalizer } from "../../domain/tag/TagNormalizer";

export type InferredTagCandidate = {
  name: string;
  category: string;
};

export type TagVisionResult = {
  tags: InferredTagCandidate[];
  titleHint?: string;
};

const MAX_TAGS = 8;
const MAX_TOOL_ROUNDS = 1;
const MAX_SEARCH_HITS = 5;

const VISION_MODEL = "@cf/qwen/qwen3.8-27b";

const ALLOWED_CATEGORIES = new Set([
  "work",
  "character",
  "item",
  "event",
  "area",
  "trade",
  "other",
]);

const SYSTEM_PROMPT = `同人・アニメグッズの写真から交換マッチング用のタグを付ける。
タグ名は日本語。必ずグッズの種類（アクリルスタンド、缶バッジ、フィギュア、ぬいぐるみ、机、デスクマット 等）を category:item で1つ以上含める。
キャラや作品が特定できなければ web_search で調べ、公式の日本語名を付ける。`;

const USER_PROMPT = "この写真のグッズをタグ付けして。";

const SEARCH_TOOL = {
  type: "function" as const,
  function: {
    name: "web_search",
    description: "写真のキャラクターや作品の日本語の公式名が分からないときにウェブ検索する",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "検索語句。外見やグッズに書かれた文字を含めてよい",
        },
      },
      required: ["query"],
    },
  },
};

const JSON_RESPONSE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "meetu_tags",
    schema: {
      type: "object",
      properties: {
        tags: {
          type: "array",
          minItems: 1,
          maxItems: MAX_TAGS,
          description:
            "日本語のタグ。必ずグッズの種類（アクリルスタンド、缶バッジ、机など）を category:item で1つ以上含める",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "日本語の表示名（例: アクリルスタンド。Acrylic Stand は不可）",
              },
              category: {
                type: "string",
                enum: ["work", "character", "item", "event", "area", "trade", "other"],
              },
            },
            required: ["name", "category"],
          },
        },
        titleHint: { type: "string", description: "短い日本語タイトル" },
      },
      required: ["tags"],
    },
    strict: true,
  },
};

export function parseVisionTagJson(response: unknown): TagVisionResult {
  const obj = unwrapJsonMode(response);
  const tags: InferredTagCandidate[] = [];
  const seen = new Set<string>();

  for (const entry of obj.tags) {
    if (!entry || typeof entry !== "object") continue;
    const name = String((entry as { name?: unknown }).name ?? "").trim();
    const category = String((entry as { category?: unknown }).category ?? "");
    if (!name || !ALLOWED_CATEGORIES.has(category)) continue;
    const key = TagNormalizer.normalize(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    tags.push({ name, category });
    if (tags.length >= MAX_TAGS) break;
  }

  if (tags.length === 0) {
    throw new ValidationError("画像からタグを読み取れませんでした");
  }

  const titleHint =
    typeof obj.titleHint === "string" && obj.titleHint.trim() ? obj.titleHint.trim() : undefined;

  return { tags, titleHint };
}

export type VisionToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export function extractToolCalls(response: unknown): VisionToolCall[] {
  if (!response || typeof response !== "object") return [];
  const r = response as {
    tool_calls?: unknown;
    choices?: {
      message?: { tool_calls?: unknown; function_call?: { name?: string; arguments?: string } };
    }[];
  };
  const raw = r.choices?.[0]?.message?.tool_calls ?? r.tool_calls;
  const calls: VisionToolCall[] = [];
  if (Array.isArray(raw)) {
    for (const call of raw) {
      if (!call || typeof call !== "object") continue;
      const c = call as {
        id?: unknown;
        function?: { name?: unknown; arguments?: unknown };
      };
      const name = String(c.function?.name ?? "");
      if (name !== "web_search") continue;
      calls.push({
        id: String(c.id ?? `call_${calls.length}`),
        name,
        arguments: String(c.function?.arguments ?? "{}"),
      });
    }
  }
  const legacy = r.choices?.[0]?.message?.function_call;
  if (!calls.length && legacy?.name === "web_search") {
    calls.push({
      id: "call_legacy",
      name: "web_search",
      arguments: String(legacy.arguments ?? "{}"),
    });
  }
  return calls.slice(0, 3);
}

export function parseSearchQuery(argsJson: string): string {
  try {
    const obj = JSON.parse(argsJson) as { query?: unknown; q?: unknown };
    return String(obj.query ?? obj.q ?? "")
      .trim()
      .slice(0, 200);
  } catch {
    return argsJson.trim().slice(0, 200);
  }
}

export function formatSearchHits(
  items: { title: string; url: string; description?: string }[],
): string {
  if (items.length === 0) return "検索結果なし";
  return items
    .slice(0, MAX_SEARCH_HITS)
    .map((item, i) => `${i + 1}. ${item.title}\n${item.description ?? ""}\n${item.url}`)
    .join("\n\n");
}

function unwrapJsonMode(response: unknown): { tags: unknown[]; titleHint?: unknown } {
  if (!response || typeof response !== "object") {
    throw new ValidationError("画像解析に失敗しました");
  }
  const r = response as {
    tags?: unknown;
    response?: unknown;
    choices?: { message?: { content?: unknown } }[];
  };
  for (const candidate of [r, r.response, r.choices?.[0]?.message?.content]) {
    const obj = asTagsObject(candidate);
    if (obj) return obj;
  }
  throw new ValidationError("画像解析に失敗しました");
}

function asTagsObject(value: unknown): { tags: unknown[]; titleHint?: unknown } | undefined {
  if (typeof value === "string" && value.trim()) {
    try {
      value = JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  if (value && typeof value === "object" && Array.isArray((value as { tags?: unknown }).tags)) {
    return value as { tags: unknown[]; titleHint?: unknown };
  }
  return undefined;
}

function bytesToBase64DataUrl(bytes: Uint8Array, contentType: string): string {
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}

export class TagVisionService {
  constructor(
    private ai: Ai,
    private webSearch?: WebSearch,
  ) {}

  async inferFromImage(bytes: Uint8Array, contentType: string): Promise<TagVisionResult> {
    const dataUrl = bytesToBase64DataUrl(bytes, contentType);
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: USER_PROMPT },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ];

    try {
      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const allowSearch = !!this.webSearch && round < MAX_TOOL_ROUNDS;
        const response = await this.ai.run(VISION_MODEL, {
          messages,
          max_tokens: 512,
          temperature: 0.1,
          reasoning_effort: "low",
          ...(allowSearch
            ? { tools: [SEARCH_TOOL], tool_choice: "auto" as const }
            : {
                response_format: JSON_RESPONSE_FORMAT,
              }),
        });

        const calls = allowSearch ? extractToolCalls(response) : [];
        if (calls.length === 0) return parseVisionTagJson(response);

        messages.push({
          role: "assistant",
          tool_calls: calls.map((call) => ({
            id: call.id,
            type: "function" as const,
            function: { name: call.name, arguments: call.arguments },
          })),
        });
        for (const call of calls) {
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: await this.runWebSearch(parseSearchQuery(call.arguments)),
          });
        }
      }
      throw new ValidationError("画像からタグを読み取れませんでした");
    } catch (e) {
      if (e instanceof ValidationError) throw e;
      throw new ValidationError("画像からタグを読み取れませんでした");
    }
  }

  private async runWebSearch(query: string): Promise<string> {
    if (!this.webSearch || !query) return "検索結果なし";
    try {
      const { items } = await this.webSearch.search({ query, limit: MAX_SEARCH_HITS });
      return formatSearchHits(items);
    } catch {
      return "検索に失敗しました";
    }
  }
}
