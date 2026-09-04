import Lean.Data.Json
import MeetUExchange.Examples
import MeetUExchange.HungarianCost

/-!
Serialize the concrete theorem witnesses in `Examples` to JSON.
TypeScript tests load that file; they do not duplicate the numbers.
-/

namespace MeetUExchange.ExportTests

open Lean Json MeetUExchange.Examples

def jNat (n : Nat) : Json := Json.num (JsonNumber.fromNat n)

def natArr (xs : Array Nat) : Json :=
  Json.arr (xs.map fun n : Nat => jNat n)

def pairArr (xs : Array (Nat × Nat)) : Json :=
  Json.arr (xs.map fun p : Nat × Nat => Json.arr #[jNat p.1, jNat p.2])

def optNatArr (xs : Array (Option Nat)) : Json :=
  Json.arr (xs.map fun
    | some n => jNat n
    | none => Json.null)

def caseObj (fields : List (String × Json)) : Json :=
  Json.mkObj fields

def cover3Sigma : Array Nat := #[(next3 0).val, (next3 1).val, (next3 2).val]

def cover3Edges : Array (Nat × Nat) := #[(0, 1), (1, 2), (2, 0)]

def cover3Expect : Json :=
  Json.mkObj [
    ("perfect", Json.bool true),
    ("balanced", Json.bool true),
    ("iteratesToCycle", Json.bool true),
    ("partialCover", Json.bool true),
    ("hasPathEndpoint", Json.bool false),
    ("iterate", Json.mkObj [
      ("start", jNat 0),
      ("k", jNat 3),
      ("end", jNat 0)])]

def pathSigma : Array (Option Nat) := #[some 1, none]

def pathEdges : Array (Nat × Nat) := #[(0, 1)]

def splitCase (id thm : String) (n : Nat) (sigma edges expect : Json) : Json :=
  caseObj [
    ("id", Json.str id),
    ("theorem", Json.str thm),
    ("kind", Json.str "splitMatching"),
    ("n", jNat n),
    ("sigma", sigma),
    ("edges", edges),
    ("expect", expect)]

def hungarianCase (n ops : Nat) : Json :=
  caseObj [
    ("id", Json.str s!"hungarianOps_eq_four_n_cubed n={n}"),
    ("theorem", Json.str "hungarianOps_eq_four_n_cubed"),
    ("kind", Json.str "hungarianCost"),
    ("n", jNat n),
    ("expect", Json.mkObj [("ops", jNat ops)])]

def payload : Json :=
  Json.mkObj [
    ("source", Json.str "MeetUExchange.Examples"),
    ("cases", Json.arr #[
      splitCase
        "cover3.toSplitMatching.Perfect"
        "CycleCover.toSplitMatching_perfect"
        3 (natArr cover3Sigma) (pairArr cover3Edges) cover3Expect,
      splitCase
        "cover3.toSplitMatching.Balanced"
        "CycleCover.toSplitMatching_balanced"
        3 (natArr cover3Sigma) (pairArr cover3Edges) cover3Expect,
      splitCase
        "iteratePerm perm3 3 0 = 0"
        "exists_cycle_len / CycleCover.closes"
        3 (natArr cover3Sigma) (pairArr cover3Edges) cover3Expect,
      splitCase
        "pathMatch.not_Balanced"
        "SplitMatching.not_balanced_has_endpoint"
        2 (optNatArr pathSigma) (pairArr pathEdges)
        (Json.mkObj [
          ("perfect", Json.bool false),
          ("balanced", Json.bool false),
          ("partialCover", Json.bool false),
          ("hasPathEndpoint", Json.bool true)]),
      hungarianCase 3 (hungarianOps 3),
      hungarianCase 4 (hungarianOps 4)
    ])]

def jsonString : String := Json.pretty payload ++ "\n"

end MeetUExchange.ExportTests
