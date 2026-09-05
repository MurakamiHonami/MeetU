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
Categories must be one of: work, character, item, event, area, trade, other.
Always include at least one "item" category tag naming the merchandise type in Japanese, for example:
アクリルスタンド/アクスタ, 缶バッジ, 色紙, タペストリー, カード, キーホルダー, フィギュア, 机, ポスター.
If space is limited, prioritize keeping the item type tag over extra work/character tags.`;

const USER_PROMPT =
  'Identify works, characters, item types, and other match tags in this photo. At least one tag must be category "item" naming the merchandise type (e.g. アクリルスタンド/アクスタ, 缶バッジ, 色紙, タペストリー, カード, キーホルダー, フィギュア, 机, ポスター). Respond with JSON only: {"tags":[{"name":"...","category":"work|character|item|event|area|trade|other"}],"titleHint":"optional short Japanese title"}';

/**
 * MAX_TAGS 超過時、item（種別）タグはマッチングで重要なので work/character より優先して残す。
 * 元の並び順は維持する。
 */
function selectWithinLimit(tags: InferredTagCandidate[]): InferredTagCandidate[] {
  if (tags.length <= MAX_TAGS) return tags;

  const kept = new Set<InferredTagCandidate>();
  for (const tag of tags) {
    if (kept.size >= MAX_TAGS) break;
    if (tag.category === "item") kept.add(tag);
  }
  for (const tag of tags) {
    if (kept.size >= MAX_TAGS) break;
    kept.add(tag);
  }
  return tags.filter((tag) => kept.has(tag));
}

export function parseVisionTagJson(raw: unknown): TagVisionResult {
  if (!raw || typeof raw !== "object") {
    throw new ValidationError("画像からタグを読み取れませんでした");
  }
  const obj = raw as { tags?: unknown; titleHint?: unknown };
  if (!Array.isArray(obj.tags)) {
    throw new ValidationError("画像からタグを読み取れませんでした");
  }

  const parsed: InferredTagCandidate[] = [];
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

    parsed.push({ name, category });
  }

  if (parsed.length === 0) {
    throw new ValidationError("画像からタグを読み取れませんでした");
  }

  const tags = selectWithinLimit(parsed);

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

function hasTagsArray(value: unknown): value is { tags: unknown[] } {
  return !!value && typeof value === "object" && Array.isArray((value as { tags?: unknown }).tags);
}

/**
 * Workers AI は経路によって:
 * - { response: string }
 * - { response: { tags: [...] } }  ← 現行の vision がよく返す
 * - { result: { response: ... } }（REST 封筒）
 * - OpenAI 互換 choices
 * を返す。いずれも tags オブジェクトまで辿る。
 */
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
    result?: { tags?: unknown; response?: unknown };
    choices?: { message?: { content?: unknown } }[];
  };

  if (hasTagsArray(r)) return r;
  if (r.result && hasTagsArray(r.result)) return r.result;

  const candidates: unknown[] = [r.response, r.result?.response, r.choices?.[0]?.message?.content];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return parseJsonLoose(candidate);
    }
    if (hasTagsArray(candidate)) {
      return candidate;
    }
  }

  throw new ValidationError("画像解析に失敗しました");
}

function parseJsonLoose(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    return JSON.parse(trimmed);
  } catch {
    // 散文に JSON が埋もれている場合、最初のオブジェクトを拾う
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
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
