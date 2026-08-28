# MeetU
「推し活の“欲しい”と“会いたい”をつなぐ」

LINE 上でグッズ譲渡・イベント同行者をマッチングするアプリ。
LIFF + LINE Login + Messaging API + Cloudflare Workers (TypeScript / Hono / D1 / KV / R2)。

## アーキテクチャ方針 (ADR-001)

- **言語**: TypeScript (フロントエンド・バックエンド統一)
- **実行基盤**: Cloudflare Workers
- **DB / Storage**: D1 (SQLite) + KV (Cache) + R2 (Object Storage)
- **設計思想**: Domain-Driven Design (DDD) + Clean Architecture

詳細は [docs/ADR-001.md](docs/ADR-001.md) および [docs/dev-setup.md](docs/dev-setup.md)。

## 仕組み

条件は **タグ** で登録する。既存タグから選ぶか、その場で新しく作れる。
**一致したタグの件数** で行う。

```
【求】プロセカ / 天馬司 / アクスタ / 東京都   ← 3件以上一致で通知
【譲】プロセカ / 天馬司 / 缶バッジ / 東京都
      一致 = プロセカ・天馬司・東京都 = 3件  → マッチ成立 → LINE に通知
```

- しきい値はカードごとに「◯件以上一致で通知」で設定する
- ★を付けたタグは **必須タグ**（相手が必ず持っている必要がある）
- しきい値は両者で別々に評価し、**満たした側にだけ通知**する

## ディレクトリ構成

```
backend/
  src/
    domain/            # ドメイン層 (Entities, Value Objects, MatchingEngine)
    usecase/           # ユースケース層 (Application Services)
    infrastructure/    # インフラ層 (D1 Repositories, LINE Client)
    interfaces/        # インターフェース層 (Hono Routes, Middleware)
  tests/               # Vitest + Miniflare インメモリテスト
  wrangler.json        # Cloudflare Workers バインディング設定
frontend/              # LIFF（React + Vite + TypeScript）
docs/
  ADR-001.md           # システムアーキテクチャ定義
  dev-setup.md         # 開発環境セットアップガイド
  design.md            # 設計書
justfile               # just コマンドランナー設定
```

## クイックスタート (just コマンド)

`just` コマンドランナーを使用して各操作を行えます：

```bash
# コマンド一覧を表示
just

# 型チェック＆全テストを実行
just check

# バックエンド ローカル起動 (Cloudflare Workers)
just dev-backend

# フロントエンド ローカル起動 (React / Vite)
just dev-frontend

# Staging デプロイ (API + Web)
just deploy-staging

# 本番デプロイ (API + Web, seed なし)
just deploy-production
```

CI/CD: PR → check のみ / `stg` merge → staging / `main` merge → production（詳細は [docs/dev-setup.md](docs/dev-setup.md)）
