# MeetU

推し活の「欲しい」と「譲る」をタグマッチングでつなぐ Web アプリ。

Email/Password 認証 + React フロント + Cloudflare Workers API（Hono / D1 / KV / R2）。

## アーキテクチャ

| 項目 | 選定 |
|------|------|
| 言語 | TypeScript（フロント・バック統一） |
| API | Cloudflare Workers + Hono |
| DB | D1 (SQLite) + Drizzle ORM |
| キャッシュ | KV（refresh token 等） |
| ストレージ | R2（画像アップロード） |
| フロント | React + Vite → Workers Static Assets |
| 設計 | DDD + Clean Architecture |
| API 契約 | Hono RPC（`hc<AppType>`） |

詳細: [docs/ADR-001.md](docs/ADR-001.md) / [docs/dev-setup.md](docs/dev-setup.md)

## 仕組み

条件は **タグ** で登録する。既存タグから選ぶか、その場で新しく作れる。
**一致したタグの件数** がしきい値以上でマッチ通知。

```
【求】プロセカ / 天馬司 / アクスタ
【譲】プロセカ / 天馬司 / 缶バッジ
      一致 = プロセカ・天馬司 = 2件 → マッチ成立
```

- しきい値はカードごとに設定
- ★付きタグは **必須タグ**（相手が必ず持っている必要がある）

## ディレクトリ構成

```
backend/src/
  domain/          # エンティティ・ドメインサービス
  usecase/         # アプリケーションサービス
  infrastructure/  # D1 リポジトリ、R2、認証
  interfaces/      # Hono ルート、ミドルウェア、Zod バリデーション
frontend/src/
  app/ pages/ widgets/ features/ entities/ shared/
docs/
  ADR-001.md  ADR-002.md  ADR-003.md  dev-setup.md
justfile
```

## クイックスタート

```bash
# 依存関係インストール（npm workspaces、1 回の npm ci）
just setup

# バックエンド + フロントを同時起動
just dev

# または個別起動
just dev-backend   # localhost:8787
just dev-frontend  # localhost:5173

# CI と同じ検証
just ci
```

## デプロイ

```bash
just deploy-staging      # staging API + Web
just deploy-production   # production API + Web
```

CI/CD: PR → `just ci` / `stg` merge → staging deploy（CI 通過後）/ `main` merge → production deploy（CI 通過後）

## 環境 URL

| 環境 | Web | API |
|------|-----|-----|
| Staging | https://meetu.staging.ruxel.net | https://api-meetu-staging.ruxel.net |
| Production | https://meetu.ruxel.net | https://api.meetu.ruxel.net |
