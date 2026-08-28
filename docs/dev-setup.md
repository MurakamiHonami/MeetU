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

**Cloudflare API Token の権限（`CLOUDFLARE_API_TOKEN`）**

`wrangler.json` で `custom_domain: true` のルートを使うため、**Account 権限だけでは足りません**。`ruxel.net` ゾーンへの Zone 権限も必要です。

| スコープ | 権限 |
|----------|------|
| Account | Workers Scripts **Edit** |
| Account | D1 **Edit** |
| Account | Workers KV Storage **Edit** |
| Account | Workers R2 Storage **Edit** |
| Account | Workers Tail **Read**（任意） |
| Zone `ruxel.net` | Workers Routes **Edit** |
| Zone `ruxel.net` | DNS **Edit**（カスタムドメインの DNS 自動作成用） |

テンプレート **Edit Cloudflare Workers** をベースに、Zone Resources で `ruxel.net`（または All zones）を指定して作成するのが手早いです。

作成後 [Cloudflare Dashboard → API Tokens](https://dash.cloudflare.com/e3800962ed5e416e565f49c823868cf3/api-tokens) で権限を確認し、GitHub **Repository secrets** の `CLOUDFLARE_API_TOKEN` を更新してください。

**よくある CI エラー**

```
A request to the Cloudflare API (.../zones/.../workers/routes) failed.
Authentication error [code: 10000]
```

Worker 本体のアップロードは成功しているがルート設定で失敗している状態です。上記 Zone 権限（Workers Routes Edit）が不足していることがほとんどです。

**Environments（未使用）**

デプロイ workflow は GitHub Environments を使わず、上記 **Repository secrets** のみ参照します。本番デプロイの承認フローが必要になったら `environment: production` を workflow に戻して Environments を設定してください。

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
