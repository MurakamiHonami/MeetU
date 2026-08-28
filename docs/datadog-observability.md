# Datadog × Cloudflare Workers Observability

MeetU の API / Web Worker から **OpenTelemetry (logs + traces)** を Datadog に送る設定です。

## 前提

- Cloudflare **Workers Paid** プラン（Observability OTLP export は Free 不可）
- Datadog 組織と **API Key**（`DD_API_KEY`）

Datadog サイト（US/EU など）に応じてエンドポイントのドメインが変わります。  
既定は **US1**: `datadoghq.com` / EU: `datadoghq.eu`

## 1. Cloudflare で Destination を作る（初回のみ）

[Workers Observability → Destinations](https://dash.cloudflare.com/?to=/:account/workers-and-pages/observability/destinations) で **2 件**追加します。  
名前は wrangler の `destinations` と **完全一致** させてください。

### `datadog-traces`（Traces）

| 項目 | 値 |
|------|-----|
| Destination name | `datadog-traces` |
| Type | Traces |
| OTLP endpoint | `https://cloudflare.integrations.otlp.datadoghq.com/v1/traces` |
| Custom header | `dd-api-key`: `<DATADOG_API_KEY>` |

EU サイトの場合: `https://cloudflare.integrations.otlp.datadoghq.eu/v1/traces`

### `datadog-logs`（Logs）

| 項目 | 値 |
|------|-----|
| Destination name | `datadog-logs` |
| Type | Logs |
| OTLP endpoint | `https://cloudflare.integrations.otlp.datadoghq.com/v1/logs` |
| Custom header | `dd-api-key`: `<DATADOG_API_KEY>` |

EU: `https://cloudflare.integrations.otlp.datadoghq.eu/v1/logs`

> Managed platform 用エンドポイント（`cloudflare.integrations.otlp.*`）を使うと、Datadog 側で Cloudflare 由来と認識されます。  
> 詳細: [Datadog OTLP — Managed Platforms](https://docs.datadoghq.com/opentelemetry/setup/otlp_ingest/managed_platforms/)

Destination 作成後、ステータスが **Last: n minutes ago** になるまで Worker にトラフィックが必要です。

### CLI で Destination を作る（任意）

```bash
export DATADOG_API_KEY=...
export CLOUDFLARE_API_TOKEN=...   # Workers Observability Write 権限
bash scripts/setup-datadog-observability.sh
# EU: DATADOG_SITE=datadoghq.eu bash scripts/setup-datadog-observability.sh
```

## 2. Wrangler（リポジトリ側）

以下の Worker に `observability` ブロックを入れています。

| Worker | 設定ファイル |
|--------|-------------|
| API staging | `backend/wrangler.json` → `env.staging` |
| API production | `backend/wrangler.json` → `env.production` |
| Web staging | `frontend/wrangler.staging.json` |
| Web production | `frontend/wrangler.production.json` |

`just deploy-staging` / `just deploy-production` でデプロイすると設定が反映されます。

### サンプリング

| 環境 | traces | logs |
|------|--------|------|
| staging | 100% | 100% |
| production | 25% | 50% |

Cloudflare ダッシュボードにもテレメトリが残ります（`persist: true` 相当）。Datadog のみに送りたい場合は wrangler で `"persist": false` に変更してください。

## 3. Datadog での確認

デプロイ後数分待ってから:

1. **APM → Traces** — `service` に Worker 名（例: `meetu-backend-staging`）が出る
2. **Logs → Explorer** — `console.log` やリクエストログを検索
3. フィルタ例: `@service:meetu-backend-staging`

## 4. 料金メモ

- Cloudflare OTLP export: 2026-10-01 以降 Workers Paid で span/log イベント課金（[Cloudflare docs](https://developers.cloudflare.com/workers/observability/exporting-opentelemetry-data/)）
- Datadog: 組織の ingest / APM プランに依存

## トラブルシュート

| 症状 | 確認 |
|------|------|
| Destination **Never run** | Worker にリクエストが来ているか / サンプリング率 |
| Destination **Error** | API Key、OTLP URL（サイト一致）、Destination 名の typo |
| Traces が Datadog に無い | `observability.traces.enabled` と deploy 済みか |
