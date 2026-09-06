# 最適化スキャン

`.github/claude-scans/shared.md` を先に Read して従え。

実測できる遅さ・無駄な再計算・N+1・過大な bundle だけを拾う。
「もっと速くできそう」だけの推測は捨てる。セキュリティやライブラリ提案は他スキャンの担当。

## 調べる対象

1. CI / テストの時間
   - 直近の `CI` workflow を `gh run list --workflow=ci.yml --limit 10` で見る
   - 同じジョブが前回より明らかに伸びている、または何度も同じステップで詰まっているもの
2. API / フロントのホットパス
   - ループ内 await、同じクエリの繰り返し、クライアントでの過剰フェッチ
   - コードを Read して経路が実在するものだけ。ベンチ無しの微差は捨てる
3. バンドルと依存
   - `frontend` で client に載るべきでない server-only モジュール
   - 使っていない重い依存（import が 0 件なものは DX ではなく、ここでも出してよい）

## issue の作り方

通ったものだけ:

```
gh issue create --label auto-scan,optimization --title "..." --body "..."
```

- ラベル `optimization` が無ければ `gh label create optimization --color 1D76DB --description "Optimization scan"` してから使う
- 本文: 症状 / 根拠 / 期待する対応
- 1 回の上限 3 件
- 自動修正してよい具体的なコード変更だけ `auto-scan` を付ける
