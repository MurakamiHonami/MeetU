# MeetUExchange — N:N 環状交換の形式化

Lean 4 + mathlib で、ADR-004 / スライドが述べる **サイクル長無制限** の交換がなぜ輪として成立し、なぜ計算が O(n³) かを機械検証する。

現行の TypeScript [`CycleFinder`](../backend/src/domain/group/CycleFinder.ts) は打ち切り付き DFS であり、この証明の対象ではない（完全性は成り立たない）。

## 定理

| ファイル | 内容 |
|---|---|
| [`MeetUExchange/Digraph.lean`](MeetUExchange/Digraph.lean) | 辺 `CanTrade`（`MatchingEngine.satisfies` の抽象） |
| [`MeetUExchange/CycleCover.lean`](MeetUExchange/CycleCover.lean) | 入出次数 1 の置換は互いに素な有向閉路に分解される（`exists_cycle_len`, `orbitSet_disjoint_or_eq`） |
| [`MeetUExchange/VertexSplit.lean`](MeetUExchange/VertexSplit.lean) | 頂点分裂: 左右同時マッチ ↔ 部分サイクルカバー（輪は複数可・未所属可）。完全マッチングは「全員が輪に入る」特殊ケース |
| [`MeetUExchange/HungarianCost.lean`](MeetUExchange/HungarianCost.lean) | 分裂後 2n 頂点の密グラフで、高々 n 回の増加 × O(n²) スキャン = `hungarianOps n = 4 n³` |
| [`MeetUExchange/Assignment.lean`](MeetUExchange/Assignment.lean) | 部分サイクルカバー（輪は複数可・未所属の人可）の最大重み。完全マッチングは仮定しない。弱双対・相補スラック |

証明しないもの: `{3,4}` 制約付きカバーの NP 困難、ハンガリアン法のループ全体の停止、CycleFinder との refinement。

TypeScript へのテスト自動生成ライブラリはない。定理の固定例は [`MeetUExchange/Examples.lean`](MeetUExchange/Examples.lean) に置き、同じ数字・同じ 3-cycle / 0→1 道を [`backend/tests/cycle-cover.test.ts`](../backend/tests/cycle-cover.test.ts) で決定的に再実行する。

## ビルド

[elan](https://github.com/leanprover/elan) が必要。リポジトリルートから:

```bash
just lean-build
```

または:

```bash
cd lean
lake exe cache get   # mathlib の事前ビルド（初回）
lake build
```

Lean 版は [`lean-toolchain`](lean-toolchain)（mathlib `v4.26.0` に合わせた 4.26.0）。`lean/.lake/` は git に含めない。

`just ci` / GitHub Actions には含めない。ローカルでは `just lean-build`。
