import { zValidator as honoZValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import { z } from "zod";
import { validationErrorResponse } from "./schemas";

/**
 * このプロジェクト共通の zValidator ラッパー。
 *
 * @hono/zod-validator をそのまま使うと、バリデーション失敗時のレスポンス形式が
 * デフォルトの `{ success: false, error: ... }` になる。既存 API 互換のため
 * `validationErrorResponse()`（{ error, details }）の形に統一し、常に 400 を返す。
 *
 * 重要: json/query/param のスキーマを route ハンドラの型に乗せるのはこの
 * zValidator を通した場合のみ。ハンドラ内で手動 `c.req.json()` + safeParse する
 * パターン（parseJson/readJsonBody）は素朴には動くが、HonoRPC (`hc<AppType>`) の
 * クライアント型にボディ/クエリの型が反映されず、フロントの型安全性が失われる。
 * 新しいルートは必ずこの zValidator を使うこと。
 */
export function zValidator<T extends z.ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return honoZValidator(target, schema, (result, c) => {
    if (!result.success) {
      // zod v4 実行時は常に ZodError（.flatten() を持つ具象クラス）のインスタンスが渡ってくる。
      // @hono/zod-validator の型は zod v3/v4 両対応のため内部コア型 $ZodError で表現しており、
      // ここで instanceof により本来の z.ZodError 型へ絞り込む。
      const error =
        result.error instanceof z.ZodError ? result.error : new z.ZodError(result.error.issues);
      return c.json(validationErrorResponse(error), 400);
    }
  });
}
