# オタクマッチング LINE アプリ 設計書

## 1. 全体像

```
LINE アプリ
  │ LINE Login (LIFF ID Token)
  ▼
LIFF (React + Vite / S3 + CloudFront)
  ├─ カード登録（譲 / 求 / 同行者求）
  ├─ 募集を探す
  ├─ マッチ一覧
  └─ 評価・通報
  │ Authorization: Bearer <IDToken>
  ▼
API Gateway (REST)
  ▼
Lambda (Python 3.12)
  ├─ 認証: LINE verify API で IDToken 検証 → userId
  ├─ マッチングエンジン: スコアリング方式
  ▼
DynamoDB (シングルテーブル)
  │ 高スコア検出
  ▼
LINE Messaging API (Push)
  「条件に一致するカードが見つかりました！」
```

## 2. カード種別

| 種別 | 表示 | 内容 | マッチ相手 |
|---|---|---|---|
| `GIVE` | 【譲】 | グッズを譲りたい | `WANT` |
| `WANT` | 【求】 | グッズが欲しい | `GIVE` |
| `COMPANION` | 【同行者求】 | イベント同行者募集 | `COMPANION` |

## 3. データモデル（DynamoDB シングルテーブル）

テーブル名: `OtakuMatchTable`
キー: `PK` (HASH) / `SK` (RANGE)

| エンティティ | PK | SK | 主な属性 |
|---|---|---|---|
| ユーザー | `USER#<userId>` | `PROFILE` | displayName, pictureUrl, ratingAvg, ratingCount, reportCount, status |
| カード | `CARD#<cardId>` | `META` | ownerId, type, title, note, tags[], requiredTags[], minMatchCount, dates[], status, createdAt, expiresAt |
| ユーザーのカード | `USER#<userId>` | `CARD#<cardId>` | type, title, status |
| タグ索引 | `TAGIDX#<tagId>` | `<type>#<cardId>` | cardId, ownerId, createdAt |
| タグマスタ | `TAG#<tagId>` | `META` | displayName, category, useCount |
| マッチ | `MATCH#<matchId>` | `META` | cardAId, cardBId, userAId, userBId, matchedTags[], matchCount, status, createdAt |
| ユーザーのマッチ | `USER#<userId>` | `MATCH#<matchId>` | partnerId, matchedTags[], matchCount, status |
| メッセージ | `MSG#<matchId>` | `<messageId>` | senderId, text, createdAt（messageId が時系列に並ぶ） |
| 評価 | `USER#<toUserId>` | `REVIEW#<reviewId>` | fromUserId, matchId, rating(1-5), comment, createdAt |
| 通報 | `REPORT#<reportId>` | `META` | reporterId, targetUserId, matchId, reason, detail, status |

### GSI

| 名前 | GSI1PK | GSI1SK | 用途 |
|---|---|---|---|
| `GSI1` | `TAG#<tagId>` | `<useCount 逆順>#<tagId>` | タグのサジェスト（人気順） |

> **タグ索引はメインテーブルで完結する。** `PK = TAGIDX#<tagId>` を Query すれば
> そのタグを持つカードが全部取れる。候補抽出はこの Query をタグの数だけ回し、
> 返ってきた `cardId` の**出現回数を数えるだけで一致タグ数が求まる**。全件スキャンは不要。

## 4. マッチングロジック（タグ一致方式）

### 4-1. 考え方

- 条件はすべて **タグ** で表現する。既存タグから選ぶか、**その場で新規作成**できる。
- マッチ = **一致タグ数が `minMatchCount` 以上**。完全一致は要求しない。
- `requiredTags` を指定した場合、そのタグだけは相手が全部持っている必要がある。
- スコアや％は出さない。出すのは **一致したタグそのもの**。

```
【求】tags = [プロセカ, 天馬司, アクスタ, 東京都, 手渡し]  minMatchCount = 3
【譲】tags = [プロセカ, 天馬司, 缶バッジ, 東京都, 郵送]
        ↓ 一致 = [プロセカ, 天馬司, 東京都] = 3件 ≥ 3
      マッチ成立
```

### 4-2. タグ

| 項目 | 内容 |
|---|---|
| カテゴリ | `work`（作品）/ `character`（キャラ）/ `item`（アイテム）/ `event`（イベント）/ `area`（エリア）/ `trade`（取引方法）/ `other` |
| 正規化 | NFKC 変換 → 小文字化 → 空白・記号除去 → これを `tagId` にする |
| 表記 | `displayName` は最初に登録された表記を保持して表示に使う |
| 新規作成 | 入力に一致する既存タグが無ければ `TAG#<tagId>` を新規作成 |
| サジェスト | 前方一致 + `useCount` 人気順で候補を返す |
| 上限 | 1 カードあたり **10 タグまで**（候補抽出の Query 回数を抑えるため） |

> 表記ゆれ対策: 「プロセカ」「ぷろせか」「ﾌﾟﾛｾｶ」は正規化で吸収する。
> それでも別タグになるもの（「プロジェクトセカイ」等）は `aliasOf` で既存タグに寄せられるようにする。

### 4-3. 一致件数しきい値

- カードごとに `minMatchCount`（既定 **2**）を持つ。
- LIFF 側 UI: 「**◯件以上一致したら通知**」のスライダー（1〜タグ数）。
- 大きくすると精度重視・通知が減る。小さくすると網羅重視・通知が増える。
- **判定は両方向で行う。** A のしきい値と B のしきい値は別々に評価し、
  片方だけ満たす場合は**満たした側にだけ通知**する。

### 4-4. タグで表せない条件（構造化フィールド）

| 項目 | キー | 判定 |
|---|---|---|
| 日程 | `dates[]` | 双方が指定したときのみ集合の積が空でないこと |

> 未指定なら判定しない（＝通す）。これ以外は全部タグで表現する。
> **金銭のやり取りはしない（物々交換のみ）ため、価格の概念は持たない。**

### 4-5. 判定ロジック（疑似コード）

```python
def find_matches(card):
    # 1) タグ索引を引いて cardId ごとの一致タグを集める
    counter = defaultdict(set)
    for tag in card.tags:                      # 最大 10 回の Query
        for hit in query(PK=f"TAGIDX#{tag}"):
            if is_counterpart(card.type, hit.type):   # 譲⇔求 / 同行⇔同行
                counter[hit.cardId].add(tag)

    for card_id, matched in counter.items():
        other = get_card(card_id)
        if excluded(card, other):                     # §4-6
            continue
        if not set(card.requiredTags) <= set(other.tags):
            continue
        if not hard_conditions_ok(card, other):       # §4-4
            continue

        # 3) しきい値をそれぞれ評価
        notify_me   = len(matched) >= card.minMatchCount
        notify_them = len(matched) >= other.minMatchCount
        if notify_me or notify_them:
            save_match(card, other, sorted(matched))
            if notify_me:   push(card.ownerId,  other, matched)
            if notify_them: push(other.ownerId, card,  matched)
```

### 4-6. 除外ルール（判定前に弾く）

- 自分自身のカード / 同一ユーザーのカード
- ブロック済み、通報により `status = SUSPENDED` のユーザー
- 既にマッチ済みのカードの組み合わせ（`MATCH#<小さいcardId>_<大きいcardId>` で冪等化）
- `status != OPEN` のカード
- `expiresAt` を過ぎたカード

### 4-7. 通知文（Flex Message）

```
条件に一致するカードが見つかりました！

【譲】天馬司 アクスタ 譲ります
一致したタグ: プロセカ / 天馬司 / 東京都   ← 3件
800円 ・ ★4.8（12件）

              [ カードを見る ]
```

## 5. API 設計

ベース: `https://<api-id>.execute-api.<region>.amazonaws.com/Prod`
認証: `Authorization: Bearer <LIFF ID Token>`（webhook を除く全エンドポイント）

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/me` | 自分のプロフィール取得（初回は自動作成） |
| PUT | `/me` | プロフィール更新（エリア・推し） |
| POST | `/cards` | カード登録 → 直後に §4-5 の双方向マッチングを実行 |
| GET | `/cards` | タグ検索（`?type=&tags=a,b,c&minMatch=2`） |
| GET | `/cards/{cardId}/matches` | そのカードにタグ一致するカード一覧（「募集を探す」の主導線） |
| GET | `/tags` | タグのサジェスト（`?q=プロセ&limit=20`、人気順） |
| POST | `/tags` | タグ新規作成（正規化して既存があればそれを返す） |
| GET | `/cards/mine` | 自分のカード一覧 |
| DELETE | `/cards/{cardId}` | カード削除（クローズ） |
| GET | `/matches` | マッチ一覧（一致タグ `matchedTags` 付き） |
| POST | `/matches/{matchId}/accept` | 承諾 → 双方に連絡先案内を通知 |
| POST | `/matches/{matchId}/decline` | 辞退 |
| GET | `/matches/{matchId}/messages` | トークの取得（`?after=` で差分だけ） |
| POST | `/matches/{matchId}/messages` | メッセージ送信（双方承諾後のみ） |
| POST | `/reviews` | 取引後の評価（1〜5＋コメント） |
| POST | `/reports` | 通報 |
| POST | `/line/webhook` | Messaging API webhook（署名検証あり） |

## 6. 認証フロー

1. LIFF 起動 → `liff.init()` → 未ログインなら `liff.login()`
2. `liff.getIDToken()` で ID Token 取得
3. API へ `Authorization: Bearer <token>` で送信
4. Lambda が `https://api.line.me/oauth2/v2.1/verify` に `id_token` と `client_id` を POST して検証
5. レスポンスの `sub` を **userId** として利用（Messaging API の userId と同一）
6. 検証結果を Lambda メモリに数分キャッシュ（毎回の外部通信を減らす）

> ID Token をそのまま信用せず必ずサーバ側で検証する。`aud` が自分の LINE Login チャネル ID であることも確認する。

## 7. 安心設計（評価・通報）

- **評価**: マッチ `status=COMPLETED` の相手のみ評価可能。1マッチ1回。`ratingAvg` / `ratingCount` を原子的に更新。
- **通報**: 理由を選択式（未着 / 商品状態 / 迷惑行為 / 詐欺 / その他）＋自由記述。
- **自動対応**: `reportCount >= 3` で `status=SUSPENDED` → カード作成・マッチング対象から除外。
- **表示**: カードに相手の平均評価と取引回数を表示。評価が無いユーザーは「新規」バッジ。
- やり取りは **アプリ内のトーク**で行う。連絡先そのものはアプリに保持しない。
- **金銭のやり取りは行わない（物々交換のみ）。**

## 8. ディレクトリ構成

```
otaku-match/
├── template.yaml            # SAM テンプレート
├── samconfig.toml
├── backend/
│   ├── requirements.txt
│   └── src/
│       ├── app.py           # ルーティング
│       ├── auth.py          # ID Token 検証
│       ├── db.py            # DynamoDB アクセス
│       ├── tags.py          # タグ正規化・サジェスト・作成
│       ├── matching.py      # タグ一致エンジン
│       ├── notify.py        # Messaging API Push / Flex
│       └── handlers/
│           ├── cards.py
│           ├── matches.py
│           ├── messages.py
│           ├── reviews.py
│           ├── reports.py
│           └── webhook.py
├── frontend/                # React + Vite (LIFF)
│   ├── index.html
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── liff.ts
│       ├── api.ts
│       └── pages/
│           ├── Home.tsx
│           ├── CardNew.tsx
│           ├── Search.tsx
│           ├── Chat.tsx
│           ├── Matches.tsx
│           └── Review.tsx
├── docs/design.md
└── linebot-lecture-src/     # 既存サンプル（残置）
```

## 9. LINE 側で必要な設定

| 項目 | 用途 |
|---|---|
| LINE Login チャネル | LIFF・ID Token 検証（Channel ID が `aud`） |
| Messaging API チャネル | プッシュ通知・webhook |
| LIFF ID | フロントの `liff.init()` |
| Channel Access Token | Push 送信 |
| Channel Secret | webhook 署名検証 |

> 2つのチャネルは**同じプロバイダー配下**に作る。そうしないと userId が一致せず、LIFF で得た ID と Push 先の ID が食い違う。

## 10. 実装フェーズ

1. **Phase 1**: SAM 基盤（DynamoDB / API Gateway / Lambda）＋ 認証 ＋ `/me`
2. **Phase 2**: タグ機能 ＋ カード CRUD ＋ 検索
3. **Phase 3**: タグ一致エンジン ＋ Push 通知
4. **Phase 4**: 評価・通報
5. **Phase 5**: LIFF フロント（React + Vite）
6. **Phase 6**: デプロイ・疎通確認
