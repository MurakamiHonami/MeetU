import { Card } from "../../src/domain/card/Card";
import { MatchingEngine } from "../../src/domain/match/MatchingEngine";
import { TradeStep } from "../../src/domain/group/TradeGroup";

/**
 * Test-only oracles for Lean properties. Not production code.
 *
 * | Lean | TS |
 * |---|---|
 * | `SplitMatching` / `IsMatching` + `edge` | `isSplitMatching` |
 * | `SplitMatching.Perfect` | `isPerfect` |
 * | `SplitMatching.Balanced` / `IsBalanced` | `isBalanced` |
 * | `exists_cycle_len` / `CycleCover.closes` | `iteratesToCycle` |
 * | `PartialCycleCover` | `isPartialCycleCover` |
 * | `not_balanced_has_endpoint` | `hasPathEndpoint` |
 * | `matchingValue` / `dualValue` / `DualFeasible` / CS | below |
 */

export type CanTrade = (giver: number, receiver: number) => boolean;

export function isSplitMatching(
  sigma: readonly (number | undefined)[],
  n: number,
  canTrade: CanTrade,
): boolean {
  if (sigma.length !== n) return false;
  const usedIn = new Set<number>();
  for (let i = 0; i < n; i++) {
    const j = sigma[i];
    if (j === undefined) continue;
    if (!Number.isInteger(j) || j < 0 || j >= n) return false;
    if (usedIn.has(j)) return false;
    if (!canTrade(i, j)) return false;
    usedIn.add(j);
  }
  return true;
}

export function isPerfect(sigma: readonly (number | undefined)[], n: number): boolean {
  return sigma.length === n && sigma.every((j) => j !== undefined);
}

export function isBalanced(sigma: readonly (number | undefined)[], n: number): boolean {
  const domain = new Set<number>();
  const range = new Set<number>();
  for (let i = 0; i < n; i++) {
    const j = sigma[i];
    if (j !== undefined) {
      domain.add(i);
      range.add(j);
    }
  }
  if (domain.size !== range.size) return false;
  for (const v of domain) {
    if (!range.has(v)) return false;
  }
  return true;
}

export function iteratesToCycle(sigma: readonly (number | undefined)[], n: number): boolean {
  if (!isPerfect(sigma, n)) return false;
  for (let x = 0; x < n; x++) {
    let y = x;
    let closed = false;
    for (let k = 1; k <= n; k++) {
      const next = sigma[y];
      if (next === undefined) return false;
      y = next;
      if (y === x) {
        closed = true;
        break;
      }
    }
    if (!closed) return false;
  }
  return true;
}

export function isPartialCycleCover(
  sigma: readonly (number | undefined)[],
  n: number,
  canTrade: CanTrade,
): boolean {
  if (!isSplitMatching(sigma, n, canTrade) || !isBalanced(sigma, n)) return false;
  const carrier: number[] = [];
  for (let i = 0; i < n; i++) {
    if (sigma[i] !== undefined) carrier.push(i);
  }
  const cap = Math.max(carrier.length, 1);
  for (const x of carrier) {
    let y = x;
    let closed = false;
    for (let k = 1; k <= cap; k++) {
      const next = sigma[y];
      if (next === undefined) return false;
      y = next;
      if (y === x) {
        closed = true;
        break;
      }
    }
    if (!closed) return false;
  }
  return true;
}

export function hasPathEndpoint(sigma: readonly (number | undefined)[], n: number): boolean {
  if (isBalanced(sigma, n)) return false;
  const gives = (v: number) => sigma[v] !== undefined;
  const receives = (v: number) => sigma.some((j) => j === v);
  for (let v = 0; v < n; v++) {
    if (gives(v) !== receives(v)) return true;
  }
  return false;
}

export function matchingValue(
  w: readonly (readonly number[])[],
  sigma: readonly (number | undefined)[],
): number {
  let sum = 0;
  for (let i = 0; i < sigma.length; i++) {
    const j = sigma[i];
    if (j !== undefined) sum += w[i]![j]!;
  }
  return sum;
}

export function dualValue(u: readonly number[], v: readonly number[]): number {
  return u.reduce((a, x) => a + x, 0) + v.reduce((a, x) => a + x, 0);
}

export function isDualFeasible(
  w: readonly (readonly number[])[],
  u: readonly number[],
  v: readonly number[],
): boolean {
  const n = u.length;
  if (v.length !== n || w.length !== n) return false;
  for (let i = 0; i < n; i++) {
    if (u[i]! < 0 || v[i]! < 0 || w[i]?.length !== n) return false;
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (w[i]![j]! > u[i]! + v[j]!) return false;
    }
  }
  return true;
}

export function hasComplementarySlackness(
  w: readonly (readonly number[])[],
  u: readonly number[],
  v: readonly number[],
  sigma: readonly (number | undefined)[],
): boolean {
  const n = sigma.length;
  for (let i = 0; i < n; i++) {
    const j = sigma[i];
    if (j === undefined) {
      if (u[i] !== 0) return false;
    } else if (u[i]! + v[j]! !== w[i]![j]!) {
      return false;
    }
  }
  for (let j = 0; j < n; j++) {
    const received = sigma.some((t) => t === j);
    if (!received && v[j] !== 0) return false;
  }
  return true;
}

const MIN_CYCLE = 3;
const MAX_CYCLE = 4;

export function tradeCycleIsPartialCover(steps: TradeStep[], cards: Map<string, Card>): boolean {
  if (steps.length < MIN_CYCLE || steps.length > MAX_CYCLE) return false;

  const froms = steps.map((s) => s.fromUserId);
  const tos = steps.map((s) => s.toUserId);
  if (new Set(froms).size !== steps.length) return false;
  if (new Set(tos).size !== steps.length) return false;

  for (let i = 0; i < steps.length; i++) {
    const next = steps[(i + 1) % steps.length];
    if (steps[i].toUserId !== next.fromUserId) return false;
  }

  for (const step of steps) {
    const give = cards.get(step.giveCardId);
    const want = cards.get(step.wantCardId);
    if (!give || !want) return false;
    if (give.ownerId !== step.fromUserId || want.ownerId !== step.toUserId) return false;
    if (MatchingEngine.satisfies(want, give) === null) return false;
  }
  return true;
}
