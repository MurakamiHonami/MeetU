# MeetU 開発環境 ＆ デプロイガイド

本プロジェクトは **TypeScript (Cloudflare Workers / D1 / KV / R2) + React (Cloudflare Pages)** の構成で構築されています。
ドメイン駆動設計 (DDD) および クリーンアーキテクチャ に基づいて設計されています。

---

## 1. 前提条件

- **Node.js**: v20 以上推奨 (npm v10 以上)
- **just**: タスクランナー (推奨: `brew install just`)
- **Cloudflare アカウント**

---

## 2. タスクランナー (`just`)

```bash
just               # コマンド一覧
just check         # db:verify + 型チェック + テスト
just dev-backend   # localhost:8787
just dev-frontend  # localhost:5173
```

### デプロイ（よく使う）

| コマンド | 内容 |
|----------|------|
| `just deploy-staging` | staging API + Web をデプロイ |
| `just deploy-production` | 本番 API + Web をデプロイ（seed なし） |
| `just release-staging` | check + staging API + D1 migrate + Web |
| `just release-production` | check + 本番 API + D1 migrate + Web |
| `just staging-setup` | release-staging + デモ seed 投入 |

| 環境 | Web | API |
|------|-----|-----|
| Staging | https://meetu.staging.ruxel.net | https://api-meetu-staging.ruxel.net |
| Production | https://meetu.ruxel.net | https://api.meetu.ruxel.net |

個別デプロイ: `deploy-staging-backend`, `deploy-staging-frontend`, `deploy-production-backend`, `deploy-production-frontend`

### データベース

```bash
just db-generate          # schema.ts → SQL 生成
just db-migrate-local     # ローカル SQLite
just d1-migrate-staging   # staging D1
just d1-migrate-production
just d1-seed-staging      # staging にデモデータ（本番には入れない）
```

---

## 3. CI/CD（GitHub Actions）

### ブランチとデプロイ先

```
feature/*  →  PR  →  CI のみ（テスト・型チェック・secret scan）
       ↓ merge
     stg      →  staging へ自動デプロイ
       ↓ merge
     main     →  production へ自動デプロイ（seed なし）
```

| Workflow | トリガー | 内容 |
|----------|----------|------|
| `ci.yml` | PR | check のみ |
| `deploy-staging.yml` | `stg` への push | `just release-staging` |
| `deploy-production.yml` | `main` への push | `just release-production` |

手動実行も可能（Actions → Run workflow）。

### GitHub 設定（初回のみ）

**Repository secrets**（CI / デプロイはここだけ見る）

| Secret | 必須 | 用途 |
|--------|------|------|
| `CLOUDFLARE_API_TOKEN` | ✅ | Wrangler デプロイ |
| `JWT_SECRET` | 本番のみ | 本番 Worker の JWT 署名鍵（deploy 時に同期） |

`CLOUDFLARE_ACCOUNT_ID` は workflow に直書き（公開情報）。API URL も同様。

Cloudflare API Token の権限例: Account → Workers Scripts Edit, D1 Edit, Workers KV Storage Edit, Workers R2 Storage Edit。

**Environments（任意）**

- `staging` / `production` … Required reviewers で本番承認フローを付けられる

**`stg` ブランチ**

```bash
git checkout -b stg && git push -u origin stg
```

---

## 4. Cloudflare デプロイ手順

### ステップ 1: Cloudflare CLI ログイン

```bash
just login
```

### ステップ 2: クラウドコンポーネント（D1, KV, R2）の作成

初回デプロイ時、以下のリソースを作成します：

```bash
cd backend && npx wrangler d1 create meetu-db
cd backend && npx wrangler kv namespace create CACHE_KV
cd backend && npx wrangler r2 bucket create meetu-uploads
```

発行された `database_id` および KV `id` を `backend/wrangler.json` のバインディング情報に設定します。

### ステップ 3: データベーススキーマ（Drizzle）

スキーマの正は `backend/src/infrastructure/db/schema.ts` です。

```bash
just db-generate       # schema.ts 変更後に SQL を生成
just db-migrate-local  # ローカル SQLite に適用
just db-verify         # CI と同じ検証
just d1-migrate        # 本番 D1 に適用 (wrangler d1 migrations apply)
```

**ワークフロー**

1. `schema.ts` を編集
2. `just db-generate` → `drizzle/NNNN_*.sql` が生成される
3. `just db-verify`
4. `just d1-migrate`
5. `just deploy-staging-backend`

### 環境構成 (staging / production)

| | Staging | Production |
|---|---|---|
| Frontend | `https://meetu.staging.ruxel.net` | `https://meetu.ruxel.net` |
| API | `https://api-meetu-staging.ruxel.net` | `https://api.meetu.ruxel.net` |
| Worker (API) | `meetu-backend-staging` | `meetu-backend` |
| Worker (Web) | `meetu-web-staging` | `meetu-web` |
| D1 | `meetu-db-staging` | `meetu-db` |

**ドメイン (ruxel.net)**

| 用途 | URL |
|------|-----|
| Staging フロント | `https://meetu.staging.ruxel.net` |
| Staging API | `https://api-meetu-staging.ruxel.net` |
| 本番フロント | `https://meetu.ruxel.net` |
| 本番 API | `https://api.meetu.ruxel.net` |

API は `api.meetu.ruxel.net`（`meetu.api.ruxel.net` ではなくこちらを採用）。

1. `ruxel.net` を Cloudflare で管理
2. `wrangler.json` の `custom_domain` で DNS を自動作成
3. フロントは Worker 静的アセット（staging / production それぞれ別 Worker）

URL の一覧はルートの `domains.env` を参照。

### デモデータ (シード)

D1 をリセットしたあとなど、スワイプ用のサンプルカードが空になることがあります。

```bash
just dev-backend   # 別ターミナル
just db-seed       # ローカル

just d1-seed-staging   # staging API へ投入
```

デモアカウント例: `seed-yuki@meetu.local` / `seedpass123`

### ステップ 4: バックエンド (Workers) のデプロイ

```bash
just deploy-staging-backend
just d1-migrate-staging
just d1-seed-staging
```

### ステップ 5: フロントエンド (Cloudflare Pages) のデプロイ

`frontend/.env.staging` で `VITE_API_BASE_URL` を staging API に設定済みです。

```bash
just deploy-staging-frontend
```

または一式:

```bash
just staging-setup
```
