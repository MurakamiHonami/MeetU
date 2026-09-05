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

const VISION_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

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
タグ名は日本語。必ずグッズの種類（アクリルスタンド、缶バッジ、フィギュア、ぬいぐるみ、机、デスクマット 等）を category:item で1つ以上含める。`;

const USER_PROMPT = "この写真のグッズをタグ付けして。";

/** Workers AI JSON Mode。https://developers.cloudflare.com/workers-ai/features/json-mode/ */
const TAG_JSON_SCHEMA = {
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

/** JSON Mode は `{ response: { tags, titleHint } }`。binding 直返しの `{ tags }` も受ける。 */
function unwrapJsonMode(response: unknown): { tags: unknown[]; titleHint?: unknown } {
  if (!response || typeof response !== "object") {
    throw new ValidationError("画像解析に失敗しました");
  }
  const r = response as { tags?: unknown; response?: unknown };
  const payload = Array.isArray(r.tags) ? r : r.response;
  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray((payload as { tags?: unknown }).tags)
  ) {
    throw new ValidationError("画像解析に失敗しました");
  }
  return payload as { tags: unknown[]; titleHint?: unknown };
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
        max_tokens: 512,
        temperature: 0.1,
        response_format: {
          type: "json_schema",
          json_schema: TAG_JSON_SCHEMA,
        },
      });
      return parseVisionTagJson(response);
    } catch (e) {
      if (e instanceof ValidationError) throw e;
      throw new ValidationError("画像からタグを読み取れませんでした");
    }
  }
}
