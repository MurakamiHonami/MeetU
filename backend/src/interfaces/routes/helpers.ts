import { Context } from "hono";

type StatusCode = 400 | 401 | 403 | 404 | 409 | 500;

export function apiError(c: Context, status: StatusCode, message: string, code?: string) {
  return c.json({ message, code, error: message }, status);
}

export function baseUrl(c: Context): string {
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}`;
}

export function handleError(c: Context, e: unknown) {
  const message = e instanceof Error ? e.message : "サーバーエラーが発生しました";
  if (message.includes("見つかりません")) return apiError(c, 404, message, "not_found");
  if (message.includes("当事者") || message.includes("参加者"))
    return apiError(c, 403, message, "forbidden");
  if (message.includes("承諾") || message.includes("完了後") || message.includes("評価済み")) {
    return apiError(c, 409, message, "conflict");
  }
  if (message.includes("通報") || message.includes("停止"))
    return apiError(c, 403, message, "suspended");
  if (
    message.includes("入力") ||
    message.includes("指定") ||
    message.includes("送れ") ||
    message.includes("5MB")
  ) {
    return apiError(c, 400, message, "bad_request");
  }
  return apiError(c, 400, message, "error");
}
