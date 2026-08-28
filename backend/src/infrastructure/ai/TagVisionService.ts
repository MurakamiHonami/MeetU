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

function extractModelText(response: unknown): string {
  if (typeof response === "string") return response;
  if (!response || typeof response !== "object") {
    throw new ValidationError("画像解析に失敗しました");
  }
  const r = response as { response?: string; result?: { response?: string } };
  const text = r.response ?? r.result?.response;
  if (typeof text !== "string" || !text.trim()) {
    throw new ValidationError("画像解析に失敗しました");
  }
  return text;
}

export class TagVisionService {
  constructor(private ai: Ai) {}

  async inferFromImage(bytes: Uint8Array, contentType: string): Promise<TagVisionResult> {
    const dataUrl = bytesToBase64DataUrl(bytes, contentType);

    const response = await this.ai.run("@cf/meta/llama-3.2-11b-vision-instruct", {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            'Identify works, characters, item types, and other match tags in this photo. Respond with JSON only: {"tags":[{"name":"...","category":"work|character|item|event|area|trade|other"}],"titleHint":"optional short Japanese title"}',
        },
      ],
      image: dataUrl,
      max_tokens: 512,
    });

    const text = extractModelText(response);
    const jsonText = text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "");
    try {
      return parseVisionTagJson(JSON.parse(jsonText));
    } catch {
      throw new ValidationError("画像からタグを読み取れませんでした");
    }
  }
}
