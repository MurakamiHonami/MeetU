import { Context } from "hono";
import { DomainError } from "../../domain/shared/DomainError";

type StatusCode = 400 | 401 | 403 | 404 | 409 | 500;

export function apiError(c: Context, status: StatusCode, message: string, code?: string) {
  return c.json({ message, code, error: message }, status);
}

export function baseUrl(c: Context): string {
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}`;
}

/**
 * ユースケース層から投げられたエラーを HTTP レスポンスに変換する。
 *
 * DomainError（NotFoundError / ForbiddenError / ConflictError / ValidationError）は
 * status/code を自身が持つので instanceof でそのまま使う。エラーメッセージの文言には
 * 依存しないため、メッセージを変更・追加してもレスポンスの意味は変わらない。
 *
 * 素の Error（DomainError でないもの）は原則バグか未分類の入力エラーなので 400 に倒す。
 * 新しいユースケースエラーは DomainError のサブクラスとして投げること。
 */
export function handleError(c: Context, e: unknown) {
  if (e instanceof DomainError) {
    return apiError(c, e.status, e.message, e.code);
  }
  const message = e instanceof Error ? e.message : "サーバーエラーが発生しました";
  return apiError(c, 400, message, "error");
}
