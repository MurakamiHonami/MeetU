# セキュリティスキャン

`.github/claude-scans/shared.md` を先に Read して従え。

依存と認証まわりの、実在する脆弱性・秘密漏洩・権限の緩さだけを拾う。
パフォーマンスや DX、ライブラリの新しさは他スキャンの担当なのでここでは見ない。

## 調べる対象

1. `npm audit --json`（ルート / backend / frontend）。high 以上だけ。
   修正手段が lockfile / バージョン上げで済むものに限る
2. 認証・認可・シークレット
   - ハードコードされた秘密、ログへのトークン出力、CORS の緩さ
   - mock 認証が本番で開きうる経路
   - テスト以外での `throw new Error` による権限エラーの飲み込みは対象外（規約違反は DX 側）
3. Workers / Wrangler
   - 本番バインディングにテスト用の緩い設定が混ざっていないか
   - 公開してはいけない値が `wrangler.json` やクライアントに載っていないか

## issue の作り方

通ったものだけ:

```
gh issue create --label auto-scan,security --title "..." --body "..."
```

- ラベル `security` が無ければ `gh label create security --color B60205 --description "Security scan"` してから使う
- 本文: 症状 / 根拠（コマンドと出力） / 期待する対応
- 1 回の上限 4 件。影響の大きい順
- `auto-scan` を付けると claude.yml が自動で PR を出す。自動修正してよいものだけに付けること
