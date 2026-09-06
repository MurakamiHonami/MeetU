# 開発体験スキャン

`.github/claude-scans/shared.md` を先に Read して従え。

ローカル開発・CI・ドキュメントの摩擦のうち、今このリポジトリで起きているものだけを拾う。
「一般的にこうした方がいい」は捨てる。セキュリティや本番パフォーマンスは他スキャンの担当。

## 調べる対象

1. `docs/dev-setup.md` と実際の手順のズレ
   - 書いてあるコマンドを実行して、今の tree で失敗するもの
2. スクリプト / just
   - `just --list` と package.json の scripts。壊れている、名前と実態が違う、二重定義
3. 型・lint・テストの手元体験
   - `just typecheck` / `just ci` の明らかな無駄（同じチェックの二重実行など）
   - 失敗メッセージが役に立たない、キャッシュでローカルだけ通る、など実害があるもの
4. オンボーディング
   - 必要な秘密の名前がドキュメントと GitHub Environments で食い違っている

## issue の作り方

通ったものだけ:

```
gh issue create --label auto-scan,dx --title "..." --body "..."
```

- ラベル `dx` が無ければ `gh label create dx --color 0E8A16 --description "Developer experience scan"` してから使う
- 本文: 症状 / 根拠 / 期待する対応
- 1 回の上限 3 件
- リポジトリ内の具体的な修正で済むものだけ `auto-scan`。ツールチェーン刷新のような方針変更は `proposal` にして `auto-scan` は付けない
