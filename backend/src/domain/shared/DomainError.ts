/**
 * ユースケース層で送出するエラーの基底クラス。
 *
 * インターフェース層の handleError() はこのクラス階層を instanceof で判定して
 * HTTP ステータスを決める。エラーメッセージの文言（日本語文字列）は
 * ステータス決定に一切使わないため、メッセージを自由に変更・追記しても
 * レスポンスの status/code は変わらない。
 *
 * 新しいユースケースエラーを追加するときは、必ずこの4種類のいずれかを使うこと。
 * 素の `throw new Error(...)` は handleError で 400 (bad_request) 扱いになる。
 */
export abstract class DomainError extends Error {
  abstract readonly status: 400 | 403 | 404 | 409;
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** 対象のリソース（カード・マッチ・グループ・ユーザー等）が存在しない */
export class NotFoundError extends DomainError {
  readonly status = 404 as const;
  readonly code = "not_found";
}

/** リソースは存在するが、要求元にその操作を行う権限・資格がない */
export class ForbiddenError extends DomainError {
  readonly status = 403 as const;
  readonly code = "forbidden";
}

/** リソースの現在の状態が要求された操作と矛盾する（二重実行・順序違反など） */
export class ConflictError extends DomainError {
  readonly status = 409 as const;
  readonly code = "conflict";
}

/** 入力値が不正・条件を満たさない */
export class ValidationError extends DomainError {
  readonly status = 400 as const;
  readonly code = "bad_request";
}
