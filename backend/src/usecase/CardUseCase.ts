import { ICardRepository } from "../domain/card/ICardRepository";
import { ITagRepository } from "../domain/tag/ITagRepository";
import { IMatchRepository } from "../domain/match/IMatchRepository";
import { IUserRepository } from "../domain/user/IUserRepository";
import { IGroupRepository } from "../domain/group/IGroupRepository";
import { Card, CardType } from "../domain/card/Card";
import { TagNormalizer } from "../domain/tag/TagNormalizer";
import { Tag } from "../domain/tag/Tag";
import { MatchingEngine } from "../domain/match/MatchingEngine";
import { CycleFinder } from "../domain/group/CycleFinder";
import { TradeGroup } from "../domain/group/TradeGroup";
import { Location, LocationProps } from "../domain/shared/Location";

export interface CreateCardInput {
  ownerId: string;
  type: CardType;
  title: string;
  note?: string;
  minMatchCount?: number;
  tags: { displayName: string; category?: string }[];
  requiredTags?: string[];
  dates?: string[];
  location?: LocationProps;
}

export interface CreateCardResult {
  card: Card;
  newMatches: { matchId: string; matchCount: number; matchedTags: string[]; card: Card }[];
  newGroups: TradeGroup[];
}

export class CardUseCase {
  constructor(
    private cardRepo: ICardRepository,
    private tagRepo: ITagRepository,
    private matchRepo: IMatchRepository,
    private userRepo: IUserRepository,
    private groupRepo: IGroupRepository,
  ) {}

  async createCard(input: CreateCardInput): Promise<CreateCardResult> {
    const tagIds: string[] = [];
    const tagLabels: Record<string, string> = {};
    for (const t of input.tags) {
      const tagId = TagNormalizer.normalize(t.displayName);
      tagIds.push(tagId);
      tagLabels[tagId] = t.displayName;
      const existing = await this.tagRepo.findById(tagId);
      if (!existing) {
        await this.tagRepo.save(Tag.create(t.displayName, t.category || "other"));
      }
    }
    await this.tagRepo.incrementCounts(tagIds);
    await this.tagRepo.recordCooccurrences(tagIds);

    const requiredTagIds = (input.requiredTags || []).map((r) => TagNormalizer.normalize(r));

    const card = Card.create({
      ownerId: input.ownerId,
      type: input.type,
      title: input.title,
      note: input.note,
      minMatchCount: input.minMatchCount ?? 2,
      tags: tagIds,
      tagLabels,
      requiredTags: requiredTagIds,
      dates: input.dates || [],
      location: input.location ? new Location(input.location).toJSON() : undefined,
    });
    await this.cardRepo.save(card);

    const newMatches = await this.runMatching(card);
    const newGroups = await this.runCycleFinding(card);

    return { card, newMatches, newGroups };
  }

  private async runMatching(card: Card) {
    const counterpartType: CardType =
      card.type === "GIVE" ? "WANT" : card.type === "WANT" ? "GIVE" : "COMPANION";
    const candidates = await this.cardRepo.findCandidateCardIdsByTags(card.tags, counterpartType);

    const candidateMatches = new Map<string, Set<string>>();
    for (const c of candidates) {
      if (c.ownerId === card.ownerId) continue;
      if (!candidateMatches.has(c.cardId)) candidateMatches.set(c.cardId, new Set());
      candidateMatches.get(c.cardId)!.add(c.tagId);
    }

    const ownerUser = await this.userRepo.findById(card.ownerId);
    const results: { matchId: string; matchCount: number; matchedTags: string[]; card: Card }[] =
      [];

    for (const [targetCardId, matchedTagSet] of candidateMatches.entries()) {
      const targetCard = await this.cardRepo.findById(targetCardId);
      if (!targetCard) continue;

      const targetUser = await this.userRepo.findById(targetCard.ownerId);
      const matchedTags = Array.from(matchedTagSet);

      const result = MatchingEngine.evaluate(
        card,
        targetCard,
        matchedTags,
        ownerUser ?? undefined,
        targetUser ?? undefined,
      );
      if (result) {
        await this.matchRepo.save(result.match);
        results.push({
          matchId: result.match.id,
          matchCount: result.match.matchCount,
          matchedTags: result.match.matchedLabels,
          card: targetCard,
        });
      }
    }
    return results;
  }

  private async runCycleFinding(card: Card): Promise<TradeGroup[]> {
    if (card.type !== "GIVE") return [];
    const finder = new CycleFinder(this.cardRepo);
    const cycles = await finder.findCycles(card);
    const created: TradeGroup[] = [];
    for (const steps of cycles) {
      const group = TradeGroup.create(steps, card.ownerId);
      const ok = await this.groupRepo.create(group);
      if (ok) created.push(group);
    }
    return created;
  }

  async getMyCards(ownerId: string): Promise<Card[]> {
    return this.cardRepo.findByOwnerId(ownerId);
  }

  async getCard(id: string): Promise<Card | null> {
    return this.cardRepo.findById(id);
  }

  async deleteCard(id: string, ownerId: string): Promise<Card | null> {
    const card = await this.cardRepo.findById(id);
    if (!card || card.ownerId !== ownerId) return null;
    card.close();
    await this.cardRepo.updateStatus(id, "CLOSED");
    return card;
  }

  async getCardMatches(
    cardId: string,
    userId: string,
  ): Promise<{ cards: Card[]; minMatchCount: number } | null> {
    const card = await this.cardRepo.findById(cardId);
    if (!card || card.ownerId !== userId) return null;

    const counterpartType: CardType =
      card.type === "GIVE" ? "WANT" : card.type === "WANT" ? "GIVE" : "COMPANION";
    const hits = await this.cardRepo.findCandidateCardIdsByTags(card.tags, counterpartType);

    const byCard = new Map<string, Set<string>>();
    for (const h of hits) {
      if (h.ownerId === userId) continue;
      if (!byCard.has(h.cardId)) byCard.set(h.cardId, new Set());
      byCard.get(h.cardId)!.add(h.tagId);
    }

    const matched: Card[] = [];
    for (const [cid, tags] of byCard.entries()) {
      const other = await this.cardRepo.findById(cid);
      if (!other) continue;
      const matchedTags = Array.from(tags);
      let ok = false;
      if (card.type === "WANT" && other.type === "GIVE") {
        ok = !!MatchingEngine.satisfies(card, other);
      } else if (card.type === "GIVE" && other.type === "WANT") {
        ok = !!MatchingEngine.satisfies(other, card);
      } else if (card.type === "COMPANION" && other.type === "COMPANION") {
        ok = matchedTags.length >= card.minMatchCount;
      }
      if (ok) matched.push(other);
    }
    return { cards: matched, minMatchCount: card.minMatchCount };
  }

  async searchCards(tagNames: string[], minMatch: number, type?: CardType): Promise<Card[]> {
    const tagIds = tagNames.map((n) => TagNormalizer.normalize(n));
    return this.cardRepo.searchByTags(tagIds, minMatch, type);
  }
}
