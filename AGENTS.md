# AGENTS.md

MeetU リポジトリで AI エージェント（Claude Code 等）がコードを書く際に守るべき規約。
「コードを読めば分かること」は書かない。読んだだけでは分からない、この場に固有の判断基準だけを書く。

## エラーハンドリング: DomainError を使う

ユースケース層・ドメイン層でエラーを投げるときは、**素の `throw new Error(...)` を使わない**。
必ず `backend/src/domain/shared/DomainError.ts` のサブクラスを使うこと。

| クラス | HTTP status | 用途 |
|---|---|---|
| `NotFoundError` | 404 | 対象のリソースが存在しない |
| `ForbiddenError` | 403 | リソースはあるが権限・資格がない |
| `ConflictError` | 409 | リソースの現在の状態が操作と矛盾する（二重実行・順序違反） |
| `ValidationError` | 400 | 入力値が不正・条件を満たさない |

```ts
import { NotFoundError, ForbiddenError } from "../domain/shared/DomainError";

const card = await this.cardRepo.findById(id);
if (!card) throw new NotFoundError("カードが見つかりません");
if (card.ownerId !== userId) throw new ForbiddenError("自分のカードではありません");
```

インターフェース層の `handleError()`（`backend/src/interfaces/routes/helpers.ts`）はこれを
`instanceof` で判定して status/code を決める。**エラーメッセージの文言には一切依存しない**ので、
日本語メッセージは自由に書いてよいし、変更しても意味が変わらない。

逆に素の `Error` を投げると `handleError` は無条件で 400 (`bad_request`) に倒す。意図したステータスに
ならないので、新しいユースケースエラーは必ず4種類のいずれかを使うこと。

## 新しい API ルートは zValidator を使う

新しいルートで json body / query を受け取るときは、必ず
`backend/src/interfaces/validation/validator.ts` の `zValidator(target, schema)` を使う。

```ts
import { zValidator } from "../validation/validator";
import { createCardSchema } from "../validation/schemas";

cardsRouter.post("/", zValidator("json", createCardSchema), async (c) => {
  const body = c.req.valid("json"); // 型が付く
  ...
});
```

**手動で `c.req.json()` を parse してはいけない。** 理由: このプロジェクトのフロントは
`hc<AppType>()`（Hono RPC）でバックエンドの型をそのまま使っている。zValidator を通さないルートは
body/query の型がクライアントの型に伝播せず、フロント側で気づかれずに壊れる（実例:
これが原因で `location: null` 送信や `reason: string` の型崩れが型エラーにならず埋もれていた）。

バリデーションエラー時のレスポンス形式（`{ error, details }`）は `zValidator` ラッパー内で
`validationErrorResponse()` に統一してあるので、ハンドラ側で意識する必要はない。

新しいスキーマは `backend/src/interfaces/validation/schemas.ts` に追加する。

## フロントの型はバックエンドから借りる、複製しない

フロント (`frontend/src/features/*/api.ts`) は `client.api.xxx.$get/$post(...)` のように
`hc<AppType>` 経由でバックエンドの型をそのまま使う。レスポンス型を独自に手書きしない。

- 独自に書いた型がバックエンドの実際の型とズレても、コンパイラは気づけない
- 複数箇所で同じ形の型を書くと、片方だけ更新されてズレる

やむを得ず route の返り値を超えた型（例: 複数エンドポイントを組み合わせた UI 側の型）が必要な場合は、
`api.ts` 側で `export type Foo = ...` して widget からはそれを import する（widget 側で再定義しない）。

`authenticatedFetch` を直接使うのは、ストリーミングなど `$post`/`$get` で表現できない場合のみに限る。
通常の JSON リクエストは `client.api.xxx.$post({ json, param, query })` を使うこと。

## pre-commit / pre-push

- `pre-commit`: lint-staged（oxfmt + oxlint）+ ステージした `.ts`/`.tsx` があれば `just typecheck`
- `pre-push`: `just ci-push`（**lockfile-check (`npm ci --dry-run`)** + format-check + lint + lint-secrets + **check-conventions** + db:verify + typecheck + test 一式）

lint は構文レベルのチェックであり型崩れは検出しない。型のズレに気づきたいときは
`just typecheck` を明示的に走らせる（pre-commit で TS ファイル変更時は自動で走る）。frontend の
typecheck は `tsconfig.tsbuildinfo` を消してから走らせるので、ローカルキャッシュで CI だけ落ちる
ことはない。

`just check-conventions` はこの AGENTS.md のルール（素の `throw new Error` 禁止 / ルートでの
手動 `c.req.json()` 禁止）を grep で機械的にチェックする。`just ci` に含まれているので
`git push` 時に自動で走るが、単体でも実行できる。違反が出たら本ファイルの該当セクションを見て直す。

## 少しでも気になったら issue を出す

今のブランチ／PR の目的から外れることは、**その場で実装しない**。
「やるべきか」が確定してから、ではない。**少しでも引っかかったら GitHub issue を出してよい**し、出したほうがいい。
確信がなくても、根拠が薄くても、チャットや PR コメントにだけ書いて終わらせない。

- 閾値は低くてよい。issue のノイズより、気になったことが消えるほうが高い
- 今の差分に混ぜるとレビューも bisect も壊れる（実例: Claude workflow 修正のついでに Docker を載せない）
- 今の作業のブロッカーなら、issue を先に書いてから今の PR を止めるか、スコープを明示して聞き直す

## Lean（`lean/`）

N:N 交換の頂点分裂と O(n³) コストの形式化専用。mathlib にある補題を再証明しない。
TypeScript の `CycleFinder` とは別物（ヒューリスティックは証明しない）。ビルドは `just lean-build`。
`just ci` には含めない。
