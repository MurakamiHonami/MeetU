import { ApiError, GoogleGenAI } from "@google/genai";
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

// 先頭が本命。429/503（高負荷・レート制限）のときだけ次のモデルへフォールバックする。
const VISION_MODELS = ["gemini-3.6-flash", "gemini-3.6-flash-lite"] as const;
const RETRYABLE_STATUSES = new Set([429, 503]);

/** 429/503 のときだけ送出する。呼び出し側はこれを見て次のモデルにフォールバックする */
class RetryableGeminiError extends ValidationError {}

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

/**
 * `@google/genai` の `GenerateContentResponse.text` は JSON 文字列（`responseMimeType:
 * "application/json"` 指定時）を返す。`<think>` タグの除去とプレーンテキスト中の
 * JSON 抽出フォールバックは、モデルがまれに思考過程を混ぜて返すことがあるため残す。
 */
function unwrapJsonMode(response: unknown): { tags: unknown[]; titleHint?: unknown } {
  let value = response;
  if (typeof value === "string") {
    const text = value.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    value = parseJsonObject(text);
  }
  if (value && typeof value === "object" && Array.isArray((value as { tags?: unknown }).tags)) {
    return value as { tags: unknown[]; titleHint?: unknown };
  }
  throw new ValidationError("画像解析に失敗しました");
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
  private readonly client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async inferFromImage(bytes: Uint8Array, contentType: string): Promise<TagVisionResult> {
    let lastError: unknown;
    for (let i = 0; i < VISION_MODELS.length; i++) {
      try {
        return await this.callModel(VISION_MODELS[i], bytes, contentType);
      } catch (e) {
        lastError = e;
        const hasNextModel = i < VISION_MODELS.length - 1;
        if (!hasNextModel || !(e instanceof RetryableGeminiError)) break;
      }
    }
    if (lastError instanceof ValidationError) throw lastError;
    const detail = lastError instanceof Error ? lastError.message : "";
    throw new ValidationError(
      detail ? `画像解析に失敗しました: ${detail}` : "画像解析に失敗しました",
    );
  }

  private async callModel(
    model: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<TagVisionResult> {
    try {
      const response = await this.client.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { text: USER_PROMPT },
              { inlineData: { mimeType: contentType, data: bytesToBase64(bytes) } },
            ],
          },
        ],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.1,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
          responseSchema: TAG_RESPONSE_SCHEMA,
        },
      });
      return parseVisionTagJson(response.text);
    } catch (e) {
      throw toVisionError(e);
    }
  }
}

function toVisionError(e: unknown): ValidationError {
  if (e instanceof ValidationError) return e;
  if (e instanceof ApiError) {
    const detail = apiErrorDetail(e);
    const suffix = detail ? `: ${detail}` : "";
    if (e.status === 401 || e.status === 403) {
      return new ValidationError(`このビジョンモデルは現在利用できません${suffix}`);
    }
    const message = `画像解析に失敗しました (${e.status})${suffix}`;
    return RETRYABLE_STATUSES.has(e.status)
      ? new RetryableGeminiError(message)
      : new ValidationError(message);
  }
  const detail = e instanceof Error ? e.message : "";
  return new ValidationError(
    detail ? `画像解析に失敗しました: ${detail}` : "画像解析に失敗しました",
  );
}

/** ApiError.message は `throwErrorIfNotOK` がエラーボディ全体を JSON.stringify したもの。 */
function apiErrorDetail(e: ApiError): string | undefined {
  try {
    const body = JSON.parse(e.message) as { error?: { message?: string } };
    return body.error?.message;
  } catch {
    return e.message || undefined;
  }
}
