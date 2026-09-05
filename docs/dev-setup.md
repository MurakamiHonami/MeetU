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
| `just ci` | format + oxlint + secretlint + db:verify + typecheck + coverage + tests |
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
feature/*  →  PR → just ci → merge →
     dev      →  release-staging（staging）
       ↓ PR → just ci → merge →
     main     →  staging 疎通 → release-production（本番）
```

verify（`just ci`）は PR 時の `ci.yml` だけ。deploy では再実行しない（マージ済み＝verify 済み前提）。

Dependabot の PR も **dev** 向け。patch / minor は CI 通過後に自動マージ（`dependabot-automerge.yml`）。

| Workflow | トリガー | 内容 |
|----------|----------|------|
| `ci.yml` | PR（dev / main など） | `just setup` → `just ci` |
| `dependabot-automerge.yml` | Dependabot PR → dev | patch/minor を auto-merge |
| `deploy-staging.yml` | `dev` push | `release-staging` → staging 疎通 |
| `deploy-production.yml` | `main` push | staging 疎通 → `release-production` |

**husky**

- pre-commit: `.env` / `.dev.vars` ブロック + lint-staged（oxfmt + oxlint + secretlint）
- pre-push: `just ci`

**`dev` ブランチ（初回のみ）**

```bash
git checkout main && git pull
git checkout -b dev && git push -u origin dev
```

日常は feature ブランチを **dev** に PR してマージ → staging 自動デプロイ。  
本番反映は **dev → main** の PR をマージ。

### GitHub Secrets

| Secret | 用途 |
|--------|------|
| `CLOUDFLARE_API_TOKEN` | Wrangler デプロイ（**User API Token** 推奨） |
| `JWT_SECRET` | JWT 署名（staging / production deploy 時に `wrangler secret put`） |

`JWT_SECRET` は **環境ごとに wrangler vars へ継承されない**（staging / production では deploy 時に secret として設定）。

トークン確認:

```bash
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/user/tokens/verify" | jq .success
```

### JWT Secret

| 環境 | 設定方法 |
|------|----------|
| Local | `backend/.dev.vars` |
| Staging | `JWT_SECRET` GitHub Secret（deploy-staging で自動設定） |
| Production | `JWT_SECRET` GitHub Secret（deploy-production で自動設定） |

```bash
echo "$JWT_SECRET" | npx wrangler secret put JWT_SECRET --env staging
echo "$JWT_SECRET" | npx wrangler secret put JWT_SECRET --env production
```

### Staging integration tests

本番デプロイ前・staging デプロイ後に、live API へ HTTP で疎通確認します。

```bash
just test-staging-integration   # https://api-meetu-staging.ruxel.net
```

CI: `deploy-staging` 完了後 / `deploy-production` の release 前に実行。

### Observability

Workers Logs（Cloudflare ダッシュボード内、追加 SaaS なし）: [observability.md](./observability.md)

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
