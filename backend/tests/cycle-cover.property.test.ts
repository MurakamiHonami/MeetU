import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  dualValue,
  hasComplementarySlackness,
  hasPathEndpoint,
  isBalanced,
  isDualFeasible,
  isPartialCycleCover,
  isPerfect,
  isSplitMatching,
  iteratesToCycle,
  matchingValue,
} from "./helpers/cycleCoverInvariant";

/**
 * Lean-extracted properties (Assignment / CycleCover / VertexSplit).
 * Random sampling — not a proof.
 */

type Sigma = (number | undefined)[];

function alwaysTrade(_i: number, _j: number): boolean {
  return true;
}

function matchingFromPrefs(n: number, prefs: number[]): Sigma {
  const sigma: Sigma = Array.from({ length: n }, () => undefined);
  const used = new Set<number>();
  for (let i = 0; i < n; i++) {
    const j = ((prefs[i] ?? 0) % (n + 1)) - 1;
    if (j < 0 || used.has(j)) continue;
    sigma[i] = j;
    used.add(j);
  }
  return sigma;
}

const arbN = fc.integer({ min: 1, max: 5 });

const arbMatching = arbN.chain((n) =>
  fc
    .array(fc.integer({ min: 0, max: n }), { minLength: n, maxLength: n })
    .map((prefs) => ({ n, sigma: matchingFromPrefs(n, prefs) })),
);

describe("Lean properties via fast-check", () => {
  it("generated matchings pass isSplitMatching", () => {
    fc.assert(
      fc.property(arbMatching, ({ n, sigma }) => {
        expect(isSplitMatching(sigma, n, alwaysTrade)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("¬Balanced ⇔ hasPathEndpoint", () => {
    fc.assert(
      fc.property(arbMatching, ({ n, sigma }) => {
        expect(hasPathEndpoint(sigma, n)).toBe(!isBalanced(sigma, n));
      }),
      { numRuns: 100 },
    );
  });

  it("Balanced matching ⇒ partial cycle cover", () => {
    fc.assert(
      fc.property(arbMatching, ({ n, sigma }) => {
        fc.pre(isBalanced(sigma, n));
        expect(isPartialCycleCover(sigma, n, alwaysTrade)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("Perfect matching ⇒ balanced and iteratesToCycle", () => {
    fc.assert(
      fc.property(arbMatching, ({ n, sigma }) => {
        fc.pre(isPerfect(sigma, n));
        expect(isBalanced(sigma, n)).toBe(true);
        expect(iteratesToCycle(sigma, n)).toBe(true);
      }),
      { numRuns: 80 },
    );
  });

  it("DualFeasible ⇒ matchingValue ≤ dualValue", () => {
    fc.assert(
      fc.property(
        arbMatching.chain(({ n, sigma }) =>
          fc
            .tuple(
              fc.array(fc.array(fc.integer({ min: -5, max: 20 }), { minLength: n, maxLength: n }), {
                minLength: n,
                maxLength: n,
              }),
              fc.array(fc.integer({ min: 0, max: 20 }), { minLength: n, maxLength: n }),
              fc.array(fc.integer({ min: 0, max: 20 }), { minLength: n, maxLength: n }),
            )
            .map(([w, u, v]) => ({ n, sigma, w, u, v })),
        ),
        ({ n, sigma, w, u, v }) => {
          const u2 = [...u];
          for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
              const need = w[i]![j]! - u2[i]! - v[j]!;
              if (need > 0) u2[i]! += need;
            }
          }
          expect(isDualFeasible(w, u2, v)).toBe(true);
          expect(matchingValue(w, sigma)).toBeLessThanOrEqual(dualValue(u2, v));
        },
      ),
      { numRuns: 80 },
    );
  });

  it("CS certificate ⇒ matchingValue = dualValue", () => {
    // Build (w,u,v,σ) so CS and DualFeasible hold by construction.
    fc.assert(
      fc.property(
        arbMatching.chain(({ n, sigma }) =>
          fc
            .tuple(
              fc.array(fc.integer({ min: 0, max: 15 }), { minLength: n, maxLength: n }),
              fc.array(fc.integer({ min: 0, max: 15 }), { minLength: n, maxLength: n }),
              fc.array(fc.array(fc.integer({ min: 0, max: 10 }), { minLength: n, maxLength: n }), {
                minLength: n,
                maxLength: n,
              }),
            )
            .map(([uRaw, vRaw, slack]) => {
              const u = uRaw.map((x, i) => (sigma[i] === undefined ? 0 : x));
              const received = new Set(sigma.filter((j): j is number => j !== undefined));
              const v = vRaw.map((x, j) => (received.has(j) ? x : 0));
              const w = Array.from({ length: n }, (_, i) =>
                Array.from({ length: n }, (_, j) => {
                  if (sigma[i] === j) return u[i]! + v[j]!;
                  return u[i]! + v[j]! - slack[i]![j]!;
                }),
              );
              return { n, sigma, w, u, v };
            }),
        ),
        ({ n, sigma, w, u, v }) => {
          expect(isSplitMatching(sigma, n, alwaysTrade)).toBe(true);
          expect(isDualFeasible(w, u, v)).toBe(true);
          expect(hasComplementarySlackness(w, u, v, sigma)).toBe(true);
          expect(matchingValue(w, sigma)).toBe(dualValue(u, v));
        },
      ),
      { numRuns: 80 },
    );
  });
});
