# MeetU
「推し活の“欲しい”と“会いたい”をつなぐ」

LINE 上でグッズ譲渡・イベント同行者をマッチングするアプリ。
LIFF + LINE Login + Messaging API + AWS SAM（API Gateway / Lambda / DynamoDB / S3 / CloudFront）。

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

詳細は [docs/design.md](docs/design.md)。

## カードの種類

| 種別 | 表示 | マッチ相手 |
|---|---|---|
| `GIVE` | 【譲】 | `WANT` |
| `WANT` | 【求】 | `GIVE` |
| `COMPANION` | 【同行者求】 | `COMPANION` |

## ディレクトリ

```
template.yaml          SAM テンプレート（DynamoDB / API Gateway / Lambda / S3 / CloudFront）
backend/src/           Lambda（Python 3.12・外部依存なし）
  app.py               ルーター
  auth.py              ID Token 検証
  db.py                DynamoDB アクセス
  tags.py              タグ正規化
  matching.py          タグ一致エンジン
  notify.py            Messaging API 送信・署名検証
  handlers/            各エンドポイント
backend/tests/         AWS 不要のテスト
frontend/              LIFF（React + Vite + TypeScript）
scripts/               フロントのビルド・配信スクリプト
docs/design.md         設計書
linebot-lecture-src/   元のサンプル（未使用・参考用）
```

## セットアップ

### 1. LINE 側

**LINE Login チャネルと Messaging API チャネルは同じプロバイダー配下に作ること。**
別プロバイダーだと userId が食い違い、LIFF で得た ID に通知が送れない。

1. [LINE Developers](https://developers.line.biz/console/) でプロバイダーを作る
2. **Messaging API チャネル** を作成 → チャネルシークレットとアクセストークンを控える
3. **LINE Login チャネル** を作成 → チャネル ID を控える
4. Login チャネルに **LIFF アプリ** を追加
   - サイズ: Full
   - エンドポイント URL: フロントをホスティングした URL（後述）
   - スコープ: `profile`, `openid`
   - → LIFF ID を控える

### 2. バックエンドをデプロイ

```bash
sam build
sam deploy --guided \
  --parameter-overrides \
    LineLoginChannelId=<Login チャネル ID> \
    LineChannelAccessToken=<Messaging API アクセストークン> \
    LineChannelSecret=<Messaging API チャネルシークレット> \
    LiffId=<LIFF ID>
```

Outputs に出る値を使う。

| 出力 | 用途 |
|---|---|
| `ApiBaseUrl` | フロントの `VITE_API_BASE`（スクリプトが自動で埋める） |
| `WebhookUrl` | LINE Developers の Webhook URL に登録し、「Webhookの利用」をオンにする |
| `FrontendUrl` | LIFF のエンドポイント URL に設定する |
| `FrontendBucketName` | ビルド成果物の同期先 |
| `FrontendDistributionId` | キャッシュ削除に使う |

### 3. フロントを配信

S3 + CloudFront はテンプレートに含まれているので `sam deploy` の時点で作成済み。
ビルドからキャッシュ削除まではスクリプト 1 本で走る。

```powershell
.\scripts\deploy-frontend.ps1 -StackName <スタック名> -LiffId <LIFF ID>
```

やっていること:

1. スタックの Outputs から API URL・バケット名・ディストリビューション ID を取得
2. `frontend/.env` を生成
3. `npm run build`
4. `dist/` を S3 に同期（`index.html` だけキャッシュさせない）
5. CloudFront のキャッシュを削除

終了時に出る **`FrontendUrl` を LIFF のエンドポイント URL に設定する**。
反映には数分かかる。

> **SPA のフォールバックは設定済み。** 403/404 を `/index.html` に 200 で返すよう
> CloudFront に入れてあるので、通知リンクの `/matches/<id>` を直接開ける。

ローカルで動かす場合:

```bash
cd frontend
cp .env.example .env    # VITE_LIFF_ID と VITE_API_BASE を埋める
npm install
npm run dev
```

## テスト

AWS もネットワークも不要（DynamoDB をインメモリのスタブに差し替えて実行する）。

```bash
python backend/tests/test_app.py
```

タグ正規化・しきい値・必須タグ・価格・日程・重複通知の抑止・評価・通報停止までを検証する。

## 運用上の注意

- **Push の無料枠は月 200 通**（フリープラン）。しきい値を低く設定するユーザーが増えると
  すぐ上限に達する。既定値は 2 件以上一致にしてある。
- カードとタグ索引には TTL 90 日を設定済み。放置カードは自動で消える。
- 通報が 3 件たまったユーザーは自動で `SUSPENDED` になり、カード作成とマッチング対象から外れる。
- 連絡先はアプリに保存しない。マッチ成立後は LINE のトークでやり取りしてもらう。
- アクセストークンやチャネルシークレットは SAM のパラメータで渡す。リポジトリに入れないこと。
- S3 バケットは中身が残っていると `sam delete` で消せない。先に
  `aws s3 rm s3://<バケット名> --recursive` を実行すること。
