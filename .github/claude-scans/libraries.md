# ライブラリ提案スキャン

`.github/claude-scans/shared.md` を先に Read して従え。

このスキャンは **提案だけ**。`auto-scan` ラベルは付けない。claude.yml に自動実装させない。

MeetU のスタック（Hono + Cloudflare Workers + D1/Drizzle、Next.js、Vitest、Lean 4）に
今効く、新しいが実在するライブラリ・ツールを探す。流行っているという理由だけでは出さない。

## 調べ方

1. いまの依存を `backend/package.json` と `frontend/package.json` とルートで確認する
2. 公開情報を実際に取りに行く（推測で終わらない）
   - `npm view <pkg> version` / GitHub Releases / Cloudflare Changelog
   - 公式ブログや npm の週次ダウンロードは、候補を絞ったあとで裏取りに使う
3. 提案するなら、このリポジトリの具体的なファイル・処理に対して
   「何が楽になるか」を 1 段落で書けること。書けない候補は捨てる

## 出してよい例

- 既存ライブラリの、この repo が踏んでいるバグが直った minor/major
- Workers 上で今の書き方が公式に非推奨になり、移行先が決まっているもの
- テストや生成を明らかに短くするツール（導入コストとトレードオフを書く）

## 出してはいけない例

- 「みんな使っているから」だけの React 周辺の置き換え
- 実験段階で本番 Workers に載らないもの
- すでに dependabot が PR を出している単なるバージョン上げ（それは dependabot の仕事）

## issue の作り方

通ったものだけ:

```
gh issue create --label proposal,libraries --title "..." --body "..."
```

- ラベルが無ければ
  `gh label create proposal --color 5319E7 --description "Human-reviewed proposal"` と
  `gh label create libraries --color FBCA04 --description "Library / tooling suggestion"` してから使う
- **`auto-scan` は付けない**
- 本文: 提案 / この repo のどこに効くか / 根拠 URL / やらない理由になりうる点
- 1 回の上限 2 件。0 件が普通
