# MeetU 開発環境 ＆ デプロイガイド

本プロジェクトは **TypeScript (Cloudflare Workers / D1 / KV / R2) + React (Workers Static Assets)** の npm workspaces モノレポです。
ドメイン駆動設計 (DDD) およびクリーンアーキテクチャに基づいて設計されています。

---

## 1. 前提条件

- **Node.js**: v22（`.nvmrc` 参照）
- **just**: タスクランナー (`brew install just`)
- **Cloudflare アカウント**

---

## 2. 初回セットアップ

```bash
just setup          # npm ci（workspaces で backend + frontend 一括）
cp backend/.dev.vars.example backend/.dev.vars   # JWT_SECRET を設定
just dev            # backend:8787 + frontend:5173 を同時起動
```

### よく使う just コマンド

| コマンド | 内容 |
|----------|------|
| `just setup` | 依存関係インストール |
| `just dev` | バックエンド + フロント同時起動 |
| `just ci` | format + oxlint + secretlint + db:verify + typecheck + test |
| `just check` | db:verify + typecheck + test（lint なし） |
| `just format` | oxfmt で整形 |
| `just db-seed` | ローカルにデモデータ投入（dev-backend 起動中） |

個別起動: `just dev-backend` / `just dev-frontend`

### デプロイ

| コマンド | 内容 |
|----------|------|
| `just deploy-staging` | staging API + Web |
| `just deploy-production` | 本番 API + Web |
| `just release-staging` | staging API + D1 migrate + Web |
| `just release-production` | 本番 API + D1 migrate + Web |

| 環境 | Web | API |
|------|-----|-----|
| Staging | https://meetu.staging.ruxel.net | https://api-meetu-staging.ruxel.net |
| Production | https://meetu.ruxel.net | https://api.meetu.ruxel.net |

### データベース

```bash
just db-generate
just db-migrate-local
just db-verify
just d1-migrate-staging
just d1-migrate-production
just d1-seed-staging      # staging のみ（本番 seed なし）
```

---

## 3. CI/CD（GitHub Actions）

```
feature/*  →  PR  →  just ci
       ↓ merge
     stg      →  just ci → release-staging
       ↓ merge
     main     →  just ci → release-production
```

| Workflow | トリガー | 内容 |
|----------|----------|------|
| `ci.yml` | PR | `just setup` → `just ci` |
| `deploy-staging.yml` | `stg` push | verify job → `release-staging` |
| `deploy-production.yml` | `main` push | verify job → `release-production` |

**husky**

- pre-commit: `.env` / `.dev.vars` ブロック + lint-staged（oxfmt + oxlint + secretlint）
- pre-push: `just ci`

### GitHub Secrets

| Secret | 用途 |
|--------|------|
| `CLOUDFLARE_API_TOKEN` | Wrangler デプロイ（**User API Token** 推奨） |

トークン確認:

```bash
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/user/tokens/verify" | jq .success
```

### JWT Secret

| 環境 | 設定方法 |
|------|----------|
| Local | `backend/.dev.vars` |
| Staging | `wrangler secret put JWT_SECRET --env staging`（初回のみ） |
| Production | `wrangler secret put JWT_SECRET --env production`（初回のみ） |

```bash
echo "$JWT_SECRET" | npx wrangler secret put JWT_SECRET --env staging
echo "$JWT_SECRET" | npx wrangler secret put JWT_SECRET --env production
```

---

## 4. ローカル開発メモ

- フロント API クライアント: `frontend/src/shared/api/client.ts`（`@meetu/backend` から `AppType` を import）
- モック認証: `Authorization: Bearer mock_<userId>` は **local のみ** 有効
- Vite proxy: `/api` → `http://127.0.0.1:8787`

---

## 5. Cloudflare 初回セットアップ

```bash
just login
cd backend && npx wrangler d1 create meetu-db
cd backend && npx wrangler kv namespace create CACHE_KV
cd backend && npx wrangler r2 bucket create meetu-uploads
```

`database_id` / KV `id` を `backend/wrangler.json` に反映後:

```bash
just db-generate
just db-migrate-local
just db-verify
just d1-migrate-staging
just deploy-staging-backend
```

デモデータ: `just dev-backend` → `just db-seed`（`seed-yuki@meetu.local` / `seedpass123`）

---

## 6. 関連 ADR

- [ADR-001](./ADR-001.md) — アーキテクチャ
- [ADR-002](./ADR-002.md) — 認証
- [ADR-003](./ADR-003.md) — フロント配信

旧設計書: [archive/design-legacy.md](./archive/design-legacy.md)
