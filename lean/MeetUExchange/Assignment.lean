import Mathlib.Algebra.BigOperators.Group.Finset.Basic
import Mathlib.Algebra.BigOperators.Group.Finset.Piecewise
import Mathlib.Algebra.Order.BigOperators.Group.Finset
import Mathlib.Data.Fintype.Option
import Mathlib.Data.Fintype.Pi
import Mathlib.Data.Set.Finite.Lemmas
import Mathlib.Tactic.Linarith

/-!
# Maximum-weight partial cycle cover

市場には全員がいる。解は互いに素な輪が何個あってもよく、
どこかの輪に属せない人が残ってよい。全域の完全マッチングは要求しない。

* `IsMatching` — 各人は高々1回渡す・高々1回受け取る
* `IsBalanced` — 渡すなら受け取る（道ではなく輪）
* マッチした部分集合上の置換は複数の輪に分解される（`CycleCover.exists_cycle_len`）

双対は不等式制約なので `u, v ≥ 0`。未マッチの人の双対は相補スラックで 0。
-/

namespace MeetUExchange

open Finset Set

variable {n : Nat}

abbrev Weight (n : Nat) := Fin n → Fin n → ℤ

def IsMatching (σ : Fin n → Option (Fin n)) : Prop :=
  ∀ ⦃i i' j⦄, σ i = some j → σ i' = some j → i = i'

def IsBalanced (σ : Fin n → Option (Fin n)) : Prop :=
  ∀ v : Fin n, (∃ j, σ v = some j) ↔ ∃ u, σ u = some v

def matchingValue (w : Weight n) (σ : Fin n → Option (Fin n)) : ℤ :=
  ∑ i : Fin n, match σ i with
    | none => (0 : ℤ)
    | some j => w i j

def dualValue (u v : Fin n → ℤ) : ℤ :=
  ∑ i : Fin n, u i + ∑ j : Fin n, v j

def DualFeasible (w : Weight n) (u v : Fin n → ℤ) : Prop :=
  (∀ i, 0 ≤ u i) ∧ (∀ j, 0 ≤ v j) ∧ ∀ i j : Fin n, w i j ≤ u i + v j

def ComplementarySlackness (w : Weight n) (u v : Fin n → ℤ) (σ : Fin n → Option (Fin n)) :
    Prop :=
  (∀ i j, σ i = some j → u i + v j = w i j) ∧
    (∀ i, σ i = none → u i = 0) ∧
    ∀ j, (∀ i, σ i ≠ some j) → v j = 0

theorem fiber_card_le_one (σ : Fin n → Option (Fin n)) (hinj : IsMatching σ) (j : Fin n) :
    #{i ∈ univ | σ i = some j} ≤ 1 := by
  by_contra h
  have h2 : 1 < #{i ∈ univ | σ i = some j} := Nat.lt_of_not_ge h
  obtain ⟨i, i', hi, hi', hne⟩ := one_lt_card_iff.mp h2
  exact hne (hinj (mem_filter.mp hi).2 (mem_filter.mp hi').2)

theorem match_v_as_sum (v : Fin n → ℤ) (σ : Fin n → Option (Fin n)) (i : Fin n) :
    (match σ i with | none => (0 : ℤ) | some j => v j) =
      ∑ j : Fin n, if σ i = some j then v j else 0 := by
  cases σ i with
  | none =>
    refine Eq.symm (sum_eq_zero fun j _ => by simp)
  | some j0 =>
    simp only [Option.some.injEq]
    rw [sum_ite_eq]
    simp

theorem sum_matched_v_eq (v : Fin n → ℤ) (σ : Fin n → Option (Fin n)) :
    ∑ i : Fin n, (match σ i with | none => (0 : ℤ) | some j => v j) =
      ∑ j : Fin n, #{i ∈ univ | σ i = some j} • v j := by
  simp_rw [match_v_as_sum]
  rw [sum_comm]
  refine sum_congr rfl fun j _ => ?_
  rw [sum_ite]
  simp [sum_const]

theorem sum_matched_u_le (u : Fin n → ℤ) (σ : Fin n → Option (Fin n)) (hu : ∀ i, 0 ≤ u i) :
    ∑ i : Fin n, (match σ i with | none => (0 : ℤ) | some _ => u i) ≤ ∑ i, u i :=
  sum_le_sum fun i _ => by
    cases σ i with
    | none => simpa using hu i
    | some _ => simp

theorem sum_matched_v_le (v : Fin n → ℤ) (σ : Fin n → Option (Fin n)) (hv : ∀ j, 0 ≤ v j)
    (hinj : IsMatching σ) :
    ∑ i : Fin n, (match σ i with | none => (0 : ℤ) | some j => v j) ≤ ∑ j, v j := by
  rw [sum_matched_v_eq]
  refine sum_le_sum fun j _ => ?_
  have hle : #{i ∈ univ | σ i = some j} • v j ≤ (1 : ℕ) • v j :=
    nsmul_le_nsmul_left (hv j) (fiber_card_le_one σ hinj j)
  simpa using hle

theorem matchingValue_le_dual (w : Weight n) (u v : Fin n → ℤ) (σ : Fin n → Option (Fin n))
    (hfeas : DualFeasible w u v) (hinj : IsMatching σ) :
    matchingValue w σ ≤ dualValue u v := by
  obtain ⟨hu, hv, hw⟩ := hfeas
  have hpoint (i : Fin n) :
      (match σ i with | none => (0 : ℤ) | some j => w i j) ≤
        match σ i with
        | none => 0
        | some j => u i + v j := by
    cases σ i with
    | none => simp
    | some j => simpa using hw i j
  have hsplit (i : Fin n) :
      (match σ i with | none => (0 : ℤ) | some j => u i + v j) =
        (match σ i with | none => 0 | some _ => u i) +
          (match σ i with | none => 0 | some j => v j) := by
    cases σ i <;> simp
  calc
    matchingValue w σ ≤ ∑ i, (match σ i with | none => (0 : ℤ) | some j => u i + v j) :=
      sum_le_sum fun i _ => hpoint i
    _ = ∑ i, (match σ i with | none => (0 : ℤ) | some _ => u i) +
          ∑ i, (match σ i with | none => (0 : ℤ) | some j => v j) := by
        simp_rw [hsplit, sum_add_distrib]
    _ ≤ ∑ i, u i + ∑ j, v j := add_le_add (sum_matched_u_le u σ hu) (sum_matched_v_le v σ hv hinj)

theorem matchingValue_eq_dual_of_cs (w : Weight n) (u v : Fin n → ℤ)
    (σ : Fin n → Option (Fin n)) (hinj : IsMatching σ)
    (hcs : ComplementarySlackness w u v σ) : matchingValue w σ = dualValue u v := by
  obtain ⟨htight, hu0, hv0⟩ := hcs
  have hw_uv (i : Fin n) :
      (match σ i with | none => (0 : ℤ) | some j => w i j) =
        match σ i with
        | none => 0
        | some j => u i + v j := by
    cases hσ : σ i with
    | none => simp
    | some j => simp [htight i j hσ]
  have hu_eq (i : Fin n) :
      (match σ i with | none => (0 : ℤ) | some _ => u i) = u i := by
    cases hσ : σ i with
    | none => simp [hu0 i hσ]
    | some _ => simp
  have hsplit (i : Fin n) :
      (match σ i with | none => (0 : ℤ) | some j => u i + v j) =
        (match σ i with | none => 0 | some _ => u i) +
          (match σ i with | none => 0 | some j => v j) := by
    cases σ i <;> simp
  have hv_eq :
      ∑ i : Fin n, (match σ i with | none => (0 : ℤ) | some j => v j) = ∑ j, v j := by
    rw [sum_matched_v_eq]
    refine sum_congr rfl fun j _ => ?_
    by_cases hr : ∃ i, σ i = some j
    · obtain ⟨i0, hi0⟩ := hr
      have hpos : 0 < #{i ∈ univ | σ i = some j} := by
        refine card_pos.mpr ⟨i0, ?_⟩
        simp [hi0]
      have : #{i ∈ univ | σ i = some j} = 1 :=
        le_antisymm (fiber_card_le_one σ hinj j) (Nat.succ_le_of_lt hpos)
      simp [this]
    · have hempty : univ.filter (fun i : Fin n => σ i = some j) = ∅ := by
        rw [filter_eq_empty_iff]
        intro i _
        exact fun hi => hr ⟨i, hi⟩
      have hvj : v j = 0 := hv0 j fun i hi => hr ⟨i, hi⟩
      simp [hempty, hvj]
  calc
    matchingValue w σ = ∑ i, (match σ i with | none => (0 : ℤ) | some j => u i + v j) := by
      simp only [matchingValue]; refine sum_congr rfl fun i _ => hw_uv i
    _ = ∑ i, (match σ i with | none => (0 : ℤ) | some _ => u i) +
          ∑ i, (match σ i with | none => (0 : ℤ) | some j => v j) := by
        simp_rw [hsplit, sum_add_distrib]
    _ = ∑ i, u i + ∑ j, v j := by
        refine congrArg₂ (· + ·) ?_ hv_eq
        exact sum_congr rfl fun i _ => hu_eq i

/-- A CS matching is maximum-weight among all (possibly incomplete) matchings. -/
theorem isMaxWeightMatching_of_cs (w : Weight n) (u v : Fin n → ℤ)
    (σ : Fin n → Option (Fin n)) (hinj : IsMatching σ) (hfeas : DualFeasible w u v)
    (hcs : ComplementarySlackness w u v σ) (τ : Fin n → Option (Fin n))
    (hτ : IsMatching τ) : matchingValue w τ ≤ matchingValue w σ := by
  calc
    matchingValue w τ ≤ dualValue u v := matchingValue_le_dual w u v τ hfeas hτ
    _ = matchingValue w σ := (matchingValue_eq_dual_of_cs w u v σ hinj hcs).symm

/-- A balanced CS matching is a max-weight partial cycle cover
    (several disjoint cycles; leftover people allowed). -/
theorem isMaxWeightPartialCycleCover_of_cs (w : Weight n) (u v : Fin n → ℤ)
    (σ : Fin n → Option (Fin n)) (hinj : IsMatching σ) (_hbal : IsBalanced σ)
    (hfeas : DualFeasible w u v) (hcs : ComplementarySlackness w u v σ)
    (τ : Fin n → Option (Fin n)) (hτinj : IsMatching τ) (_hτbal : IsBalanced τ) :
    matchingValue w τ ≤ matchingValue w σ :=
  isMaxWeightMatching_of_cs w u v σ hinj hfeas hcs τ hτinj

theorem exists_maxWeight_matching (w : Weight n) :
    ∃ σ : Fin n → Option (Fin n),
      IsMatching σ ∧ ∀ τ, IsMatching τ → matchingValue w τ ≤ matchingValue w σ := by
  classical
  let s : Set (Fin n → Option (Fin n)) := {σ | IsMatching σ}
  have hfin : s.Finite := s.toFinite
  have hne : s.Nonempty := by
    refine ⟨fun _ => none, ?_⟩
    intro i i' j h
    cases h
  obtain ⟨σ, hσ, hmax⟩ := exists_max_image s (matchingValue w) hfin hne
  exact ⟨σ, hσ, fun τ hτ => hmax τ hτ⟩

def dualUpdate (u v : Fin n → ℤ) (S T : Finset (Fin n)) (δ : ℤ) :
    (Fin n → ℤ) × (Fin n → ℤ) :=
  (fun i => if i ∈ S then u i - δ else u i,
    fun j => if j ∈ T then v j + δ else v j)

theorem dualUpdate_weightBounds (w : Weight n) (u v : Fin n → ℤ) (S T : Finset (Fin n))
    (δ : ℤ) (hw : ∀ i j : Fin n, w i j ≤ u i + v j) (hδ : 0 ≤ δ)
    (hmin : ∀ i ∈ S, ∀ j ∉ T, δ ≤ u i + v j - w i j) :
    ∀ i j : Fin n,
      w i j ≤ (dualUpdate u v S T δ).1 i + (dualUpdate u v S T δ).2 j := by
  intro i j
  unfold dualUpdate
  by_cases hi : i ∈ S
  · by_cases hj : j ∈ T
    · simp [hi, hj]; linarith [hw i j]
    · simp [hi, hj]; linarith [hmin i hi j hj]
  · by_cases hj : j ∈ T
    · simp [hi, hj]; linarith [hw i j, hδ]
    · simp [hi, hj]; exact hw i j

end MeetUExchange
