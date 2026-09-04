import Mathlib.Data.Finset.Image
import Mathlib.Data.Fintype.Basic
import Mathlib.Logic.Equiv.Basic
import MeetUExchange.CycleCover

/-!
# Vertex split

Each person `v` splits into an out-role (left, "gives") and an in-role (right, "receives").
An original edge `u → v` becomes the bipartite edge `out u — in v`.

The intended solution is a *partial* cycle cover: everyone is a vertex in the
market, but leftover people are allowed and there may be several disjoint cycles.

* A matching that pairs `out v` iff it pairs `in v` is exactly a partial cycle cover
  (paths appear precisely when this balance fails).
* A perfect matching of the split graph is the special case where everyone
  belongs to some cycle (a spanning cycle cover).
-/

namespace MeetUExchange

open Equiv Function

variable {n : Nat} {E : CanTrade n}

/--
Matching in the split bipartite graph.
`σ i = some j` means the out-role of `i` is matched to the in-role of `j`.
Injectivity on the right is the matching condition (each in-role used at most once).
-/
structure SplitMatching (n : Nat) (E : CanTrade n) where
  σ : Fin n → Option (Fin n)
  inj : ∀ {i i' j}, σ i = some j → σ i' = some j → i = i'
  edge : ∀ {i j}, σ i = some j → E i j

/-- Everyone's out-role is matched. Together with `inj` this is a bijection. -/
def SplitMatching.Perfect (m : SplitMatching n E) : Prop :=
  ∀ i, ∃ j, m.σ i = some j

/-- `out v` is matched iff `in v` is matched. Forbids leftover path endpoints. -/
def SplitMatching.Balanced (m : SplitMatching n E) : Prop :=
  ∀ v, (∃ j, m.σ v = some j) ↔ (∃ u, m.σ u = some v)

noncomputable def SplitMatching.mate (m : SplitMatching n E) (hp : m.Perfect) (i : Fin n) : Fin n :=
  (hp i).choose

theorem SplitMatching.mate_spec (m : SplitMatching n E) (hp : m.Perfect) (i : Fin n) :
    m.σ i = some (m.mate hp i) :=
  (hp i).choose_spec

theorem SplitMatching.mate_injective (m : SplitMatching n E) (hp : m.Perfect) :
    Injective (m.mate hp) := by
  intro a b h
  exact m.inj (m.mate_spec hp a) (h ▸ m.mate_spec hp b)

theorem SplitMatching.mate_surjective (m : SplitMatching n E) (hp : m.Perfect) :
    Surjective (m.mate hp) := by
  intro v
  have hinj := m.mate_injective hp
  have himg : (Finset.univ.image (m.mate hp)).card = n := by
    rw [Finset.card_image_of_injective _ hinj, Finset.card_univ, Fintype.card_fin]
  have huniv : Finset.univ.image (m.mate hp) = Finset.univ :=
    Finset.eq_univ_of_card _ (by rw [himg, Fintype.card_fin])
  obtain ⟨a, _, ha⟩ := Finset.mem_image.mp (by simp [huniv] : v ∈ Finset.univ.image (m.mate hp))
  exact ⟨a, ha⟩

theorem SplitMatching.mate_bijective (m : SplitMatching n E) (hp : m.Perfect) :
    Bijective (m.mate hp) :=
  ⟨m.mate_injective hp, m.mate_surjective hp⟩

/-- Perfect split matching → spanning cycle cover (everyone gives and receives once). -/
noncomputable def SplitMatching.toCycleCover (m : SplitMatching n E) (hp : m.Perfect) :
    CycleCover n E where
  next := Equiv.ofBijective (m.mate hp) (m.mate_bijective hp)
  edge := fun i => m.edge (m.mate_spec hp i)

/-- Spanning cycle cover → perfect matching of the split graph. -/
def CycleCover.toSplitMatching (cc : CycleCover n E) : SplitMatching n E where
  σ := fun i => some (cc.next i)
  inj := by
    intro i i' j hi hi'
    exact cc.next.injective ((Option.some.inj hi).trans (Option.some.inj hi').symm)
  edge := by
    intro i j h
    cases h
    exact cc.edge i

theorem CycleCover.toSplitMatching_perfect (cc : CycleCover n E) :
    cc.toSplitMatching.Perfect := fun i => ⟨cc.next i, rfl⟩

theorem CycleCover.toSplitMatching_balanced (cc : CycleCover n E) :
    cc.toSplitMatching.Balanced := by
  intro v
  constructor
  · intro _
    exact ⟨cc.next.symm v, by simp [CycleCover.toSplitMatching]⟩
  · intro _
    exact ⟨cc.next v, rfl⟩

theorem toCycleCover_next (m : SplitMatching n E) (hp : m.Perfect) (i : Fin n) :
    (m.toCycleCover hp).next i = m.mate hp i :=
  rfl

/-- The two encodings of a spanning exchange agree on successors. -/
theorem toCycleCover_toSplitMatching_next (cc : CycleCover n E) (i : Fin n) :
    (cc.toSplitMatching.toCycleCover cc.toSplitMatching_perfect).next i = cc.next i := by
  have hmate := cc.toSplitMatching.mate_spec cc.toSplitMatching_perfect i
  rw [toCycleCover_next]
  exact Option.some_injective _ (hmate.symm.trans rfl)

/-- Perfect matchings are balanced: a total injective map on a finite set is surjective. -/
theorem SplitMatching.Perfect.balanced (m : SplitMatching n E) (hp : m.Perfect) : m.Balanced := by
  intro v
  constructor
  · intro _
    obtain ⟨u, hu⟩ := (m.mate_bijective hp).surjective v
    exact ⟨u, hu ▸ m.mate_spec hp u⟩
  · intro _
    exact hp v

/-- People whose out-role is matched. -/
def SplitMatching.domain (m : SplitMatching n E) : Finset (Fin n) :=
  Finset.univ.filter (fun i => m.σ i ≠ none)

/-- Balanced matching → partial cycle cover on people who both give and receive. -/
def SplitMatching.toPartial (m : SplitMatching n E) (hb : m.Balanced) :
    PartialCycleCover n E where
  carrier := m.domain
  next := fun i =>
    match m.σ i with
    | some j => j
    | none => i
  maps := by
    intro i hi
    simp only [SplitMatching.domain, Finset.mem_filter, Finset.mem_univ, true_and] at hi ⊢
    cases hσ : m.σ i with
    | none => exact (hi hσ).elim
    | some j =>
      intro hnone
      obtain ⟨k, hk⟩ := (hb j).mpr ⟨i, hσ⟩
      rw [hnone] at hk
      cases hk
  inj := by
    intro i j hi hj hnext
    simp only [SplitMatching.domain, Finset.mem_filter, Finset.mem_univ, true_and] at hi hj
    cases hiσ : m.σ i with
    | none => exact (hi hiσ).elim
    | some a =>
      cases hjσ : m.σ j with
      | none => exact (hj hjσ).elim
      | some b =>
        have hab : a = b := by simp [hiσ, hjσ] at hnext; exact hnext
        subst hab
        exact m.inj hiσ hjσ
  edge := by
    intro i hi
    simp only [SplitMatching.domain, Finset.mem_filter, Finset.mem_univ, true_and] at hi
    cases hσ : m.σ i with
    | none => exact (hi hσ).elim
    | some j =>
      simpa [hσ] using m.edge hσ

/-- Partial cycle cover → balanced split matching. -/
def PartialCycleCover.toSplitMatching (p : PartialCycleCover n E) : SplitMatching n E where
  σ := fun i => if i ∈ p.carrier then some (p.next i) else none
  inj := by
    intro i i' j hi hi'
    by_cases hiC : i ∈ p.carrier
    · by_cases hiC' : i' ∈ p.carrier
      · simp [hiC, hiC'] at hi hi'
        exact p.inj hiC hiC' (hi.trans hi'.symm)
      · simp [hiC'] at hi'
    · simp [hiC] at hi
  edge := by
    intro i j h
    by_cases hiC : i ∈ p.carrier
    · simp [hiC] at h
      cases h
      exact p.edge i hiC
    · simp [hiC] at h

theorem PartialCycleCover.toSplitMatching_balanced (p : PartialCycleCover n E) :
    p.toSplitMatching.Balanced := by
  intro v
  constructor
  · rintro ⟨j, hj⟩
    have hv : v ∈ p.carrier := by
      by_contra hv
      simp [PartialCycleCover.toSplitMatching, hv] at hj
    simp [PartialCycleCover.toSplitMatching, hv] at hj
    cases hj
    obtain ⟨u, hu, heq⟩ := p.surj v hv
    refine ⟨u, ?_⟩
    simp [PartialCycleCover.toSplitMatching, hu, heq]
  · rintro ⟨u, hu⟩
    have huC : u ∈ p.carrier := by
      by_contra h
      simp [PartialCycleCover.toSplitMatching, h] at hu
    have hnext : p.next u = v := by
      simp [PartialCycleCover.toSplitMatching, huC] at hu
      exact hu
    have hv : v ∈ p.carrier := by
      rw [← hnext]
      exact p.maps u huC
    exact ⟨p.next v, by simp [PartialCycleCover.toSplitMatching, hv]⟩

/--
If balance fails, some person gives without receiving or receives without giving:
the selected edges contain a path endpoint rather than only cycles.
-/
theorem SplitMatching.not_balanced_has_endpoint (m : SplitMatching n E) (h : ¬m.Balanced) :
    (∃ v, (∃ j, m.σ v = some j) ∧ ∀ u, m.σ u ≠ some v) ∨
      (∃ v, (∀ j, m.σ v ≠ some j) ∧ ∃ u, m.σ u = some v) := by
  unfold SplitMatching.Balanced at h
  simp only [not_forall] at h
  obtain ⟨v, hv⟩ := h
  by_cases hL : ∃ j, m.σ v = some j
  · have hR : ¬∃ u, m.σ u = some v := fun hR => hv ⟨fun _ => hR, fun _ => hL⟩
    exact Or.inl ⟨v, hL, fun u hu => hR ⟨u, hu⟩⟩
  · have hR : ∃ u, m.σ u = some v := by
      by_contra hR
      exact hv ⟨fun hL' => (hL hL').elim, fun hR' => (hR hR').elim⟩
    exact Or.inr ⟨v, fun j hj => hL ⟨j, hj⟩, hR⟩

end MeetUExchange
