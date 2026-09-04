/-!
# Compatibility graph

MeetU の N:N 交換は有向グラフとしてモデル化する。
頂点は人、辺 `u → v` は「u の譲カードが v の求カードを満たす」こと
（`MatchingEngine.satisfies` の抽象）。
-/

namespace MeetUExchange

/-- Edge predicate on `n` people. `E u v` means `u` can give to `v`. -/
abbrev CanTrade (n : Nat) : Type := Fin n → Fin n → Prop

end MeetUExchange
