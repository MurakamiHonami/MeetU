import MeetUExchange.CycleCover
import MeetUExchange.HungarianCost
import MeetUExchange.VertexSplit
import Mathlib.Tactic.FinCases

/-!
# Concrete witnesses

Lean から TypeScript テストを自動生成するライブラリはない。
代わりに、定理を固定の有限例に実体化し、同じ例を vitest で再実行する。

対応: `lake exe export_tests` が [`fixtures/cycle-cover.json`](fixtures/cycle-cover.json) を書き、
[`backend/tests/cycle-cover.test.ts`](../backend/tests/cycle-cover.test.ts) がそれを読む。
-/

set_option linter.unnecessarySeqFocus false

namespace MeetUExchange.Examples

open Equiv

def next3 : Fin 3 → Fin 3
  | ⟨0, _⟩ => 1
  | ⟨1, _⟩ => 2
  | ⟨2, _⟩ => 0

def pred3 : Fin 3 → Fin 3
  | ⟨0, _⟩ => 2
  | ⟨1, _⟩ => 0
  | ⟨2, _⟩ => 1

def perm3 : Perm (Fin 3) where
  toFun := next3
  invFun := pred3
  left_inv := by intro i; fin_cases i <;> rfl
  right_inv := by intro i; fin_cases i <;> rfl

def E3 : CanTrade 3 := fun i j => j = next3 i

def cover3 : CycleCover 3 E3 where
  next := perm3
  edge := by intro i; fin_cases i <;> rfl

/-- VertexSplit: 3-cycle の完全マッチングは全域カバー。 -/
example : cover3.toSplitMatching.Perfect :=
  cover3.toSplitMatching_perfect

example : cover3.toSplitMatching.Balanced :=
  cover3.toSplitMatching_balanced

/-- CycleCover.closes: 0 → 1 → 2 → 0 は 3 歩で戻る。 -/
example : iteratePerm perm3 3 0 = 0 := rfl

example : ∃ k, 0 < k ∧ k ≤ 3 ∧ iteratePerm perm3 k 0 = 0 :=
  exists_cycle_len perm3 0

/-- 0→1 だけの道はバランスしない。 -/
def pathE : CanTrade 2 := fun i j => i = 0 ∧ j = 1

def pathMatch : SplitMatching 2 pathE where
  σ
    | 0 => some 1
    | 1 => none
  inj := by
    intro i i' j hi hi'
    fin_cases i <;> fin_cases i' <;> fin_cases j <;> simp at hi hi' <;> rfl
  edge := by
    intro i j h
    fin_cases i <;> fin_cases j <;> simp [pathE] at h ⊢

example : ¬pathMatch.Balanced := by
  intro hb
  have h := hb 0
  have : ∃ j, pathMatch.σ 0 = some j := ⟨1, rfl⟩
  have : ∃ u, pathMatch.σ u = some 0 := h.mp this
  obtain ⟨u, hu⟩ := this
  fin_cases u <;> simp [pathMatch] at hu

example : hungarianOps 3 = 108 := by
  rw [hungarianOps_eq_four_n_cubed]
  decide

example : hungarianOps 4 = 256 := by
  rw [hungarianOps_eq_four_n_cubed]
  decide

end MeetUExchange.Examples
