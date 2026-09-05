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

const VISION_MODEL = "@cf/google/gemma-4-26b-a4b-it";

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
タグ名は日本語。作品名・キャラクター名・グッズの種類を付ける。
必ずグッズの種類（アクリルスタンド、缶バッジ、フィギュア、ぬいぐるみ、机、デスクマット 等）を category:item で1つ以上含める。`;

const USER_PROMPT = "この写真のグッズをタグ付けして。";

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

function unwrapJsonMode(response: unknown): { tags: unknown[]; titleHint?: unknown } {
  if (!response || typeof response !== "object") {
    throw new ValidationError("画像解析に失敗しました");
  }
  const r = response as {
    tags?: unknown;
    response?: unknown;
    choices?: { message?: { content?: unknown } }[];
  };
  const nested = r.response as { choices?: { message?: { content?: unknown } }[] } | undefined;
  const result = (r as { result?: { choices?: { message?: { content?: unknown } }[] } }).result;
  for (const candidate of [
    r,
    r.response,
    result,
    r.choices?.[0]?.message?.content,
    nested?.choices?.[0]?.message?.content,
    result?.choices?.[0]?.message?.content,
  ]) {
    const obj = asTagsObject(candidate);
    if (obj) return obj;
  }
  throw new ValidationError("画像解析に失敗しました");
}

function asTagsObject(value: unknown): { tags: unknown[]; titleHint?: unknown } | undefined {
  value = flattenContent(value);
  if (typeof value === "string" && value.trim()) {
    const text = value.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    value = parseJsonObject(text);
    if (value === undefined) return undefined;
  }
  if (value && typeof value === "object" && Array.isArray((value as { tags?: unknown }).tags)) {
    return value as { tags: unknown[]; titleHint?: unknown };
  }
  return undefined;
}

function flattenContent(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object") {
        const text = (part as { text?: unknown }).text;
        return typeof text === "string" ? text : "";
      }
      return "";
    })
    .join("");
}

function parseJsonObject(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return undefined;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return undefined;
    }
  }
}

function visionUnavailableError(e: unknown): ValidationError {
  const msg = e instanceof Error ? e.message : "";
  if (/Workers Free plan|not available on the/i.test(msg)) {
    return new ValidationError("このビジョンモデルは現在利用できません");
  }
  return new ValidationError("画像解析に失敗しました");
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
  constructor(private ai: Ai) {}

  async inferFromImage(bytes: Uint8Array, contentType: string): Promise<TagVisionResult> {
    const dataUrl = bytesToBase64DataUrl(bytes, contentType);

    try {
      const response = await this.ai.run(VISION_MODEL, {
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: USER_PROMPT },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        max_tokens: 1024,
        temperature: 0.1,
        reasoning_effort: "low",
        chat_template_kwargs: { enable_thinking: false },
        response_format: JSON_RESPONSE_FORMAT,
      });
      return parseVisionTagJson(response);
    } catch (e) {
      if (e instanceof ValidationError) throw e;
      throw visionUnavailableError(e);
    }
  }
}
