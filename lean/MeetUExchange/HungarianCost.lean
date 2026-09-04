import Mathlib.Tactic.Ring

/-!
# O(n³) cost of unbounded-length assignment

After vertex split, N:N exchange with **no cycle-length cap** is an n×n assignment
problem (left = out-roles, right = in-roles). The Hungarian method / successive
shortest paths grows the matching by one edge per phase, at most `n` times.
On a dense instance the search in each phase inspects an adjacency matrix of
`(2n) × (2n)` (split vertices), i.e. O(n²) work, for a total of O(n³).

This file counts those operations. Optimality of a tight dual matching is
[`MeetUExchange/Assignment.lean`](Assignment.lean).
-/

namespace MeetUExchange

/-- Dense-graph Dijkstra / matrix scan: for each of `numVertices` rows, read
    `numVertices` columns. -/
def dijkstraDenseOps (numVertices : Nat) : Nat :=
  numVertices * numVertices

/-- Vertex split of `n` people yields `n` left vertices and `n` right vertices. -/
def splitVertexCount (n : Nat) : Nat :=
  n + n

/--
Hungarian / successive-shortest-path assignment on the split graph:
at most `n` augmentations (matching cardinality increases by 1, maximum `n`).
-/
def hungarianOps (n : Nat) : Nat :=
  n * dijkstraDenseOps (splitVertexCount n)

/-- The usual n×n assignment statement (without writing 2n split vertices). -/
def assignmentOps (n : Nat) : Nat :=
  n * dijkstraDenseOps n

theorem assignmentOps_eq_n_cubed (n : Nat) : assignmentOps n = n ^ 3 := by
  simp [assignmentOps, dijkstraDenseOps, pow_three]

theorem splitVertexCount_eq (n : Nat) : splitVertexCount n = 2 * n := by
  simp [splitVertexCount, two_mul]

/--
`n` phases × (2n)² matrix scans = 4 n³.
This is the O(n³) bound quoted for unbounded cycle covers after vertex split.
-/
theorem hungarianOps_eq_four_n_cubed (n : Nat) : hungarianOps n = 4 * n ^ 3 := by
  simp [hungarianOps, dijkstraDenseOps, splitVertexCount, pow_three]
  ring

theorem hungarianOps_le_four_n_cubed (n : Nat) : hungarianOps n ≤ 4 * n ^ 3 :=
  hungarianOps_eq_four_n_cubed n ▸ le_rfl

/-- Same cubic class as the n×n formulation. -/
theorem hungarianOps_le_of_assignment (n : Nat) :
    hungarianOps n = 4 * assignmentOps n := by
  simp [hungarianOps, assignmentOps, dijkstraDenseOps, splitVertexCount]
  ring

end MeetUExchange
