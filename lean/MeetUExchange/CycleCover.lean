import Mathlib.Data.Finset.Card
import Mathlib.Data.Fintype.Card
import Mathlib.Data.Fintype.Pigeonhole
import Mathlib.GroupTheory.Perm.Basic
import Mathlib.Tactic.WLOG
import MeetUExchange.Digraph

/-!
# Cycle covers

A spanning cycle cover is a permutation of people whose edges lie in `E`.
Each person then has out-degree 1 and in-degree 1, so iterating the successor
returns to the start: the functional graph is a disjoint union of directed cycles.
-/

namespace MeetUExchange

open Equiv Set

variable {n : Nat}

/-- Iterate the permutation `f`, starting at `x`. -/
def iteratePerm (f : Perm (Fin n)) : Nat → Fin n → Fin n
  | 0, x => x
  | k + 1, x => f (iteratePerm f k x)

@[simp]
theorem iteratePerm_zero (f : Perm (Fin n)) (x : Fin n) : iteratePerm f 0 x = x :=
  rfl

theorem iteratePerm_succ (f : Perm (Fin n)) (k : Nat) (x : Fin n) :
    iteratePerm f (k + 1) x = f (iteratePerm f k x) :=
  rfl

theorem iteratePerm_add (f : Perm (Fin n)) (a b : Nat) (x : Fin n) :
    iteratePerm f (a + b) x = iteratePerm f b (iteratePerm f a x) := by
  induction b with
  | zero => simp
  | succ b ih =>
    rw [Nat.add_succ, iteratePerm_succ, ih, iteratePerm_succ]

theorem iteratePerm_injective (f : Perm (Fin n)) (k : Nat) :
    Function.Injective (iteratePerm f k) := by
  induction k with
  | zero => intro x y h; simpa using h
  | succ k ih =>
    intro x y h
    rw [iteratePerm_succ, iteratePerm_succ] at h
    exact ih (f.injective h)

theorem iteratePerm_mul_period (f : Perm (Fin n)) {p : Nat} (x : Fin n)
    (hp : iteratePerm f p x = x) (k : Nat) : iteratePerm f (k * p) x = x := by
  induction k with
  | zero => simp
  | succ k ih =>
    rw [Nat.succ_mul, iteratePerm_add, ih, hp]

/-- Among `n+1` images in `Fin n`, two indices collide. -/
theorem fin_pigeonhole {m : Nat} (g : Fin (m + 1) → Fin m) :
    ∃ a b : Fin (m + 1), a ≠ b ∧ g a = g b :=
  Fintype.exists_ne_map_eq_of_card_lt g (by simp [Fintype.card_fin])

/--
Every person lies on a directed cycle of length at most `n`.
Because `f` is bijective, the first repeat of the orbit is a return to the start
(not a rho-shaped tail).
-/
theorem exists_cycle_len (f : Perm (Fin n)) (x : Fin n) :
    ∃ k, 0 < k ∧ k ≤ n ∧ iteratePerm f k x = x := by
  cases n with
  | zero => exact Fin.elim0 x
  | succ m =>
    obtain ⟨a, b, hne, heq⟩ :=
      fin_pigeonhole (fun i : Fin (m + 1 + 1) => iteratePerm f i.val x)
    have hvne : a.val ≠ b.val := mt Fin.eq_of_val_eq hne
    wlog hlt : a.val < b.val generalizing a b
    · rcases Nat.lt_or_gt_of_ne hvne with hlt' | hgt
      · exact this a b hne heq hvne hlt'
      · exact this b a hne.symm heq.symm (Ne.symm hvne) hgt
    refine ⟨b.val - a.val, Nat.sub_pos_of_lt hlt, ?_, ?_⟩
    · have : b.val ≤ m + 1 := Nat.le_of_lt_succ b.isLt
      omega
    · have hk : a.val + (b.val - a.val) = b.val := Nat.add_sub_of_le (Nat.le_of_lt hlt)
      have hcomp :
          iteratePerm f b.val x =
            iteratePerm f (b.val - a.val) (iteratePerm f a.val x) := by
        rw [← iteratePerm_add, hk]
      have hfix :
          iteratePerm f (b.val - a.val) (iteratePerm f a.val x) = iteratePerm f a.val x := by
        rw [← hcomp, heq]
      have hcomm :
          iteratePerm f (b.val - a.val) (iteratePerm f a.val x) =
            iteratePerm f a.val (iteratePerm f (b.val - a.val) x) :=
        calc
          iteratePerm f (b.val - a.val) (iteratePerm f a.val x)
            = iteratePerm f (a.val + (b.val - a.val)) x :=
              (iteratePerm_add f a.val (b.val - a.val) x).symm
          _ = iteratePerm f ((b.val - a.val) + a.val) x := by
            rw [Nat.add_comm a.val (b.val - a.val)]
          _ = iteratePerm f a.val (iteratePerm f (b.val - a.val) x) :=
              iteratePerm_add f (b.val - a.val) a.val x
      exact iteratePerm_injective f a.val (hcomm.symm.trans hfix)

/-- Points reachable by iterating `f` from `x`. -/
def orbitSet (f : Perm (Fin n)) (x : Fin n) : Set (Fin n) :=
  {y | ∃ k : Nat, iteratePerm f k x = y}

theorem mem_orbitSet_self (f : Perm (Fin n)) (x : Fin n) : x ∈ orbitSet f x :=
  ⟨0, rfl⟩

theorem orbitSet_eq_of_mem (f : Perm (Fin n)) {x y : Fin n} (h : y ∈ orbitSet f x) :
    orbitSet f y = orbitSet f x := by
  obtain ⟨k, rfl⟩ := h
  ext z
  constructor
  · rintro ⟨m, rfl⟩
    exact ⟨k + m, iteratePerm_add f k m x⟩
  · rintro ⟨m, rfl⟩
    obtain ⟨p, hp0, _, hp⟩ := exists_cycle_len f x
    have hle : k ≤ k * p := Nat.le_mul_of_pos_right k hp0
    refine ⟨k * p - k + m, ?_⟩
    have hsum : k + (k * p - k + m) = k * p + m := by
      rw [← Nat.add_assoc, Nat.add_sub_cancel' hle]
    calc iteratePerm f (k * p - k + m) (iteratePerm f k x)
        = iteratePerm f (k + (k * p - k + m)) x := (iteratePerm_add f k _ x).symm
      _ = iteratePerm f (k * p + m) x := by rw [hsum]
      _ = iteratePerm f m (iteratePerm f (k * p) x) := iteratePerm_add f (k * p) m x
      _ = iteratePerm f m x := by rw [iteratePerm_mul_period f x hp k]

/-- Distinct orbits are disjoint; overlapping orbits coincide. -/
theorem orbitSet_disjoint_or_eq (f : Perm (Fin n)) (x y : Fin n) :
    orbitSet f x = orbitSet f y ∨ Disjoint (orbitSet f x) (orbitSet f y) := by
  by_cases h : ∃ z, z ∈ orbitSet f x ∧ z ∈ orbitSet f y
  · left
    obtain ⟨z, hzx, hzy⟩ := h
    rw [← orbitSet_eq_of_mem f hzx, orbitSet_eq_of_mem f hzy]
  · right
    exact Set.disjoint_left.mpr fun z hzx hzy => h ⟨z, hzx, hzy⟩

variable {E : CanTrade n}

/-- Spanning cycle cover: everyone gives once and receives once along edges of `E`. -/
structure CycleCover (n : Nat) (E : CanTrade n) where
  next : Perm (Fin n)
  edge : ∀ i : Fin n, E i (next i)

/-- Successor is unique (out-degree 1). -/
theorem CycleCover.outDegree (cc : CycleCover n E) (i : Fin n) :
    (Finset.univ.filter (fun j : Fin n => cc.next i = j)).card = 1 := by
  have hset : Finset.univ.filter (fun j : Fin n => cc.next i = j) = {cc.next i} := by
    ext j
    simp [eq_comm]
  simp [hset]

theorem CycleCover.pred_iff (cc : CycleCover n E) (i j : Fin n) :
    cc.next j = i ↔ j = cc.next.symm i :=
  Equiv.apply_eq_iff_eq_symm_apply cc.next

/-- Predecessor is unique (in-degree 1). -/
theorem CycleCover.inDegree (cc : CycleCover n E) (i : Fin n) :
    (Finset.univ.filter (fun j : Fin n => cc.next j = i)).card = 1 := by
  have hset : Finset.univ.filter (fun j : Fin n => cc.next j = i) = {cc.next.symm i} := by
    ext j
    simp [cc.pred_iff]
  simp [hset]

/-- Iterating the cover from any person closes a cycle of length at most `n`. -/
theorem CycleCover.closes (cc : CycleCover n E) (x : Fin n) :
    ∃ k, 0 < k ∧ k ≤ n ∧ iteratePerm cc.next k x = x :=
  exists_cycle_len cc.next x

/-- Each orbit of a cycle cover is a directed cycle using only edges of `E`. -/
theorem CycleCover.orbit_edge (cc : CycleCover n E) {x y : Fin n}
    (_hy : y ∈ orbitSet cc.next x) : E y (cc.next y) :=
  cc.edge y

/--
Partial cycle cover on a subset `carrier`: each member gives once and receives once
inside the subset. This is the N:N exchange that does not involve every person.
-/
structure PartialCycleCover (n : Nat) (E : CanTrade n) where
  carrier : Finset (Fin n)
  next : Fin n → Fin n
  maps : ∀ i ∈ carrier, next i ∈ carrier
  inj : ∀ ⦃i j⦄, i ∈ carrier → j ∈ carrier → next i = next j → i = j
  edge : ∀ i ∈ carrier, E i (next i)

/-- An injective self-map of a finite set is surjective: everyone also receives once. -/
theorem PartialCycleCover.surj (p : PartialCycleCover n E) :
    ∀ i ∈ p.carrier, ∃ j ∈ p.carrier, p.next j = i := by
  intro i hi
  have himage : p.carrier.image p.next ⊆ p.carrier := by
    intro x hx
    obtain ⟨j, hj, rfl⟩ := Finset.mem_image.mp hx
    exact p.maps j hj
  have hcard : (p.carrier.image p.next).card = p.carrier.card :=
    Finset.card_image_of_injOn fun a ha b hb h => p.inj ha hb h
  have heq : p.carrier.image p.next = p.carrier :=
    Finset.eq_of_subset_of_card_le himage (hcard.symm ▸ le_rfl)
  have : i ∈ p.carrier.image p.next := heq.symm ▸ hi
  exact Finset.mem_image.mp this

end MeetUExchange
