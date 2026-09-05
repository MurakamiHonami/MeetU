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

const VISION_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${VISION_MODEL}:generateContent`;

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

const TAG_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    tags: {
      type: "ARRAY",
      description:
        "日本語のタグ。必ずグッズの種類（アクリルスタンド、缶バッジ、机など）を category:item で1つ以上含める",
      items: {
        type: "OBJECT",
        properties: {
          name: {
            type: "STRING",
            description: "日本語の表示名（例: アクリルスタンド。Acrylic Stand は不可）",
          },
          category: {
            type: "STRING",
            format: "enum",
            enum: ["work", "character", "item", "event", "area", "trade", "other"],
          },
        },
        required: ["name", "category"],
      },
    },
    titleHint: { type: "STRING", nullable: true, description: "短い日本語タイトル" },
  },
  required: ["tags"],
  propertyOrdering: ["tags", "titleHint"],
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
    candidates?: { content?: { parts?: unknown } }[];
    choices?: { message?: { content?: unknown } }[];
  };
  const nested = r.response as { choices?: { message?: { content?: unknown } }[] } | undefined;
  const result = (r as { result?: { choices?: { message?: { content?: unknown } }[] } }).result;
  const geminiParts = r.candidates?.[0]?.content?.parts;
  for (const candidate of [
    r,
    r.response,
    result,
    geminiParts,
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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export class TagVisionService {
  constructor(private apiKey: string) {}

  async inferFromImage(bytes: Uint8Array, contentType: string): Promise<TagVisionResult> {
    try {
      const response = await fetch(GEMINI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [
            {
              role: "user",
              parts: [
                { text: USER_PROMPT },
                { inlineData: { mimeType: contentType, data: bytesToBase64(bytes) } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
            responseMimeType: "application/json",
            responseSchema: TAG_RESPONSE_SCHEMA,
          },
        }),
      });

      if (!response.ok) {
        const errBody = (await response.json().catch(() => null)) as {
          error?: { message?: string; status?: string };
        } | null;
        console.error("gemini infer failed", response.status, errBody?.error?.message);
        throw geminiHttpError(response.status);
      }

      return parseVisionTagJson(await response.json());
    } catch (e) {
      if (e instanceof ValidationError) throw e;
      throw new ValidationError("画像解析に失敗しました");
    }
  }
}

function geminiHttpError(status: number): ValidationError {
  if (status === 401 || status === 403) {
    return new ValidationError("このビジョンモデルは現在利用できません");
  }
  return new ValidationError("画像解析に失敗しました");
}
