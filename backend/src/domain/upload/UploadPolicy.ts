import { ValidationError, ForbiddenError } from "../shared/DomainError";

export const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const BY_EXTENSION: Record<string, string> = Object.fromEntries(
  Object.entries(ALLOWED_CONTENT_TYPES).map(([mime, ext]) => [ext, mime]),
);

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const PUT_EXPIRES_SEC = 300;
export const GET_EXPIRES_SEC = 3600;

export class UploadPolicy {
  static validateContentType(contentType: string): string {
    const normalized = contentType.toLowerCase();
    if (!(normalized in ALLOWED_CONTENT_TYPES)) {
      throw new ValidationError("画像は JPEG / PNG / WebP のみ送れます");
    }
    return normalized;
  }

  static validateSize(size: number | undefined): void {
    if (size === undefined) return;
    if (!Number.isFinite(size) || size > MAX_UPLOAD_BYTES) {
      throw new ValidationError("画像は 5MB 以内にしてください");
    }
  }

  static imageKey(threadId: string, contentType: string): string {
    const ext = ALLOWED_CONTENT_TYPES[contentType];
    return `chat/${threadId}/${crypto.randomUUID()}.${ext}`;
  }

  static assertKeyBelongsToThread(imageKey: string, threadId: string): void {
    if (!imageKey.startsWith(`chat/${threadId}/`)) {
      throw new ForbiddenError("この画像は使用できません");
    }
  }
}
