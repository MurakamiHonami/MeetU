import { describe, expect, it } from "vitest";
import { Card, CardType } from "../src/domain/card/Card";
import { CardTagHit, ICardRepository } from "../src/domain/card/ICardRepository";
import { CycleFinder } from "../src/domain/group/CycleFinder";
import {
  hasPathEndpoint,
  isBalanced,
  isPartialCycleCover,
  isPerfect,
  isSplitMatching,
  iteratesToCycle,
  tradeCycleIsPartialCover,
} from "./helpers/cycleCoverInvariant";

/** Same 3-cycle as `lean/MeetUExchange/Examples.lean` (`next3`: 0→1→2→0). */
const SIGMA3 = [1, 2, 0] as const;
const CAN_TRADE_3 = (i: number, j: number) => SIGMA3[i] === j;

/** Same 0→1 path as `pathMatch` in Examples.lean. */
const SIGMA_PATH = [1, undefined] as const;
const CAN_TRADE_PATH = (i: number, j: number) => i === 0 && j === 1;

const FAR = "2099-01-01T00:00:00.000Z";
const NOW = "2026-01-01T00:00:00.000Z";

function fixedCard(id: string, ownerId: string, type: "GIVE" | "WANT", tags: string[]): Card {
  return new Card({
    id,
    ownerId,
    type,
    title: `${type}-${ownerId}`,
    minMatchCount: 1,
    tags,
    requiredTags: [],
    dates: [],
    status: "OPEN",
    createdAt: NOW,
    expiresAt: FAR,
  });
}

class MemoryCardRepo implements ICardRepository {
  constructor(private readonly cards: Card[]) {}

  async findById(id: string): Promise<Card | null> {
    return this.cards.find((c) => c.id === id) ?? null;
  }

  async findByOwnerId(ownerId: string): Promise<Card[]> {
    return this.cards.filter((c) => c.ownerId === ownerId);
  }

  async findCandidateCardIdsByTags(
    tagIds: string[],
    targetType: CardType | readonly CardType[],
  ): Promise<CardTagHit[]> {
    const types = Array.isArray(targetType) ? targetType : [targetType];
    const tagSet = new Set(tagIds);
    const hits: CardTagHit[] = [];
    for (const card of this.cards) {
      if (!types.includes(card.type)) continue;
      for (const tagId of card.tags) {
        if (tagSet.has(tagId)) {
          hits.push({ cardId: card.id, tagId, ownerId: card.ownerId });
        }
      }
    }
    return hits;
  }

  async findRecentOpen(): Promise<Card[]> {
    return [];
  }
  async findByGeohashCells(): Promise<Card[]> {
    return [];
  }
  async findByIds(ids: string[]): Promise<Card[]> {
    const want = new Set(ids);
    return this.cards.filter((c) => want.has(c.id));
  }
  async searchByTags(): Promise<Card[]> {
    return [];
  }
  async save(): Promise<void> {}
  async updateStatus(): Promise<void> {}
  async delete(): Promise<void> {}
}

/** 3-cycle market: ui gives t_i, wants t_{i+1}. */
function threeCycleCards(): { cards: Card[]; byId: Map<string, Card>; start: Card } {
  const cards: Card[] = [];
  const byId = new Map<string, Card>();
  for (let i = 0; i < 3; i++) {
    const give = fixedCard(`g${i}`, `u${i}`, "GIVE", [`t${i}`]);
    const want = fixedCard(`w${i}`, `u${i}`, "WANT", [`t${(i + 1) % 3}`]);
    cards.push(give, want);
    byId.set(give.id, give);
    byId.set(want.id, want);
  }
  return { cards, byId, start: cards[0] };
}

describe("Lean cycle-cover examples (deterministic)", () => {
  it("3-cycle perfect matching is a spanning cover (Examples.cover3)", () => {
    const sigma = [...SIGMA3];
    expect(isSplitMatching(sigma, 3, CAN_TRADE_3)).toBe(true);
    expect(isPerfect(sigma, 3)).toBe(true);
    expect(isBalanced(sigma, 3)).toBe(true);
    expect(iteratesToCycle(sigma, 3)).toBe(true);
    expect(isPartialCycleCover(sigma, 3, CAN_TRADE_3)).toBe(true);
  });

  it("0→1 path is unbalanced and has an endpoint (Examples.pathMatch)", () => {
    const sigma = [...SIGMA_PATH];
    expect(isSplitMatching(sigma, 2, CAN_TRADE_PATH)).toBe(true);
    expect(isBalanced(sigma, 2)).toBe(false);
    expect(isPartialCycleCover(sigma, 2, CAN_TRADE_PATH)).toBe(false);
    expect(hasPathEndpoint(sigma, 2)).toBe(true);
  });

  it("hungarianOps 3 = 108 and hungarianOps 4 = 256 (Examples.lean)", () => {
    const hungarianOps = (n: number) => n * (n + n) * (n + n);
    expect(hungarianOps(3)).toBe(108);
    expect(hungarianOps(4)).toBe(256);
  });

  it("CycleFinder on the planted 3-cycle returns a Lean partial cover", async () => {
    const { cards, byId, start } = threeCycleCards();
    const cycles = await new CycleFinder(new MemoryCardRepo(cards)).findCycles(start);
    expect(cycles.length).toBeGreaterThan(0);
    for (const steps of cycles) {
      expect(tradeCycleIsPartialCover(steps, byId)).toBe(true);
    }
  });
});
