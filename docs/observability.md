# Observability（Cloudflare Workers Logs）

MeetU は **Cloudflare Workers Logs**（ダッシュボード内蔵）を使います。  
Datadog など外部 SaaS は使わないため、**追加の監視ツール課金はありません**。

## どこで見るか

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages**
2. 対象 Worker を選択（例: `meetu-backend-staging`）
3. **Observability** タブ

ログ・メトリクス・Query Builder でリクエストや `console.log` を確認できます。

## 料金（Cloudflare 側）

| プラン | ログ | 保持 |
|--------|------|------|
| Workers Free | 20万イベント/日 | 3日 |
| Workers Paid | **月 2,000万イベント込み** | 7日 |

超過分は $0.60 / 100万イベント（通常の MeetU 規模ではまず超えません）。

本番 Worker は `head_sampling_rate: 0.25`（25% サンプリング）でログ量を抑えています。

## Wrangler 設定

各 Worker の wrangler に以下を設定済みです。

```json
"observability": {
  "enabled": true,
  "head_sampling_rate": 1
}
```

デプロイ後に有効化されます: `just deploy-staging` / `just deploy-production`

## ローカル開発

```bash
just dev-backend
# 別ターミナル
cd backend && npx wrangler tail
```

`wrangler tail` でリアルタイムログをターミナルに流せます（無料）。

## ログの書き方

構造化 JSON の方が Query Builder でフィルタしやすいです。

```typescript
console.log({ event: "auth_login", userId, status: res.status });
```

## 将来外部に出したい場合

無料枠のある例:

| サービス | 無料枠の目安 |
|----------|-------------|
| **Grafana Cloud** | ログ・トレースに無料 tier |
| **Axiom** | 月次 ingest 上限あり |
| **Sentry** | エラー監視の無料 tier |

その場合は Cloudflare の OTLP export + Destination 設定が必要です（[Cloudflare docs](https://developers.cloudflare.com/workers/observability/exporting-opentelemetry-data/)）。
