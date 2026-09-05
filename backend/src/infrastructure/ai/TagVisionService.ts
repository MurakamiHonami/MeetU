import { ValidationError } from "../../domain/shared/DomainError";

export type InferredTagCandidate = {
  name: string;
  category: string;
};

export type TagVisionResult = {
  tags: InferredTagCandidate[];
  titleHint?: string;
};

const MAX_TAGS = 8;

const ALLOWED_CATEGORIES = new Set([
  "work",
  "character",
  "item",
  "event",
  "area",
  "trade",
  "other",
]);

const SYSTEM_PROMPT = `You analyze photos of Japanese otaku goods (anime/game merchandise, trading cards, acrylic stands, badges, etc.).
Return JSON only with tags useful for matching traders on MeetU.
Use Japanese display names for tags (works, characters, item types, events, areas).
Categories must be one of: work, character, item, event, area, trade, other.`;

const USER_PROMPT =
  'Identify works, characters, item types, and other match tags in this photo. Respond with JSON only: {"tags":[{"name":"...","category":"work|character|item|event|area|trade|other"}],"titleHint":"optional short Japanese title"}';

export function parseVisionTagJson(raw: unknown): TagVisionResult {
  if (!raw || typeof raw !== "object") {
    throw new ValidationError("画像からタグを読み取れませんでした");
  }
  const obj = raw as { tags?: unknown; titleHint?: unknown };
  if (!Array.isArray(obj.tags)) {
    throw new ValidationError("画像からタグを読み取れませんでした");
  }

  const tags: InferredTagCandidate[] = [];
  const seen = new Set<string>();
  for (const entry of obj.tags) {
    if (!entry || typeof entry !== "object") continue;
    const name = String((entry as { name?: unknown }).name ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    let category = String((entry as { category?: unknown }).category ?? "other").toLowerCase();
    if (!ALLOWED_CATEGORIES.has(category)) category = "other";

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

function bytesToBase64DataUrl(bytes: Uint8Array, contentType: string): string {
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}

/** Workers AI の返答からテキスト／構造化 JSON を取り出す */
export function extractVisionPayload(response: unknown): unknown {
  if (typeof response === "string") {
    return parseJsonLoose(response);
  }
  if (!response || typeof response !== "object") {
    throw new ValidationError("画像解析に失敗しました");
  }

  const r = response as {
    tags?: unknown;
    response?: unknown;
    result?: { response?: unknown; tags?: unknown };
  };

  // response_format / 一部モデルはスキーマオブジェクトを直返しする
  if (Array.isArray(r.tags)) return r;
  if (r.result && typeof r.result === "object" && Array.isArray(r.result.tags)) {
    return r.result;
  }

  const text = r.response ?? r.result?.response;
  if (typeof text === "string" && text.trim()) {
    return parseJsonLoose(text);
  }

  throw new ValidationError("画像解析に失敗しました");
}

function parseJsonLoose(text: string): unknown {
  const jsonText = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(jsonText);
  } catch {
    throw new ValidationError("画像からタグを読み取れませんでした");
  }
}

export class TagVisionService {
  constructor(private ai: Ai) {}

  async inferFromImage(bytes: Uint8Array, contentType: string): Promise<TagVisionResult> {
    const dataUrl = bytesToBase64DataUrl(bytes, contentType);

    // トップレベル `image` は number[] / binary。data URL は messages 内 image_url で渡す。
    const response = await this.ai.run("@cf/meta/llama-3.2-11b-vision-instruct", {
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
    });

    try {
      return parseVisionTagJson(extractVisionPayload(response));
    } catch (e) {
      if (e instanceof ValidationError) throw e;
      throw new ValidationError("画像からタグを読み取れませんでした");
    }
  }
}
