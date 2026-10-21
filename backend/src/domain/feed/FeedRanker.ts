import { Card } from "../card/Card";
import { Tag } from "../tag/Tag";

const FAVORITE_WEIGHT = 1.0;
const OWN_CARD_WEIGHT = 0.5;
const EXPAND_WEIGHT = 0.45;
const EXPAND_TOP = 5;
const FRESH_BONUS = 0.15;

export interface FeedProfile {
  favoriteTags: string[];
  ownCardTags: string[];
}

export interface RankedCard {
  card: Card;
  score: number;
  reasonTags: string[];
}

export interface RelatedTag {
  tagId: string;
  hits: number;
}

/**
 * タグベクトル類似度によるおすすめ順ソート。
 * 外部 API を使わず、好きなタグ・共起・IDF・新着ボーナスで並べる。
 */
export class FeedRanker {
  constructor(
    private getTagsByIds: (tagIds: string[]) => Promise<Tag[]>,
    private getRelatedTagsForMany: (
      tagIds: string[],
      limit: number,
    ) => Promise<Map<string, RelatedTag[]>>,
  ) {}

  private tagWeightCache = new Map<string, number>();

  private async loadTagWeights(tagIds: Iterable<string>): Promise<void> {
    const missing = [...new Set(tagIds)].filter((id) => !this.tagWeightCache.has(id));
    if (missing.length === 0) return;
    const tags = await this.getTagsByIds(missing);
    const byId = new Map(tags.map((tag) => [tag.id, tag]));
    for (const id of missing) {
      const uses = byId.get(id)?.useCount ?? 0;
      this.tagWeightCache.set(id, 1.0 / Math.log(2.0 + uses));
    }
  }

  private tagWeight(tagId: string): number {
    // rank() が事前に loadTagWeights でまとめて埋めているので、ここは Map 参照のみ。
    return this.tagWeightCache.get(tagId) ?? 1.0 / Math.log(2.0);
  }

  buildProfile(profile: FeedProfile): Record<string, number> {
    const result: Record<string, number> = {};
    for (const tag of profile.favoriteTags) {
      result[tag] = Math.max(result[tag] ?? 0, FAVORITE_WEIGHT);
    }
    for (const tag of profile.ownCardTags) {
      result[tag] = Math.max(result[tag] ?? 0, OWN_CARD_WEIGHT);
    }
    return result;
  }

  async expandProfile(profile: Record<string, number>): Promise<Record<string, number>> {
    const tags = Object.keys(profile);
    if (tags.length === 0) return {};
    const expanded = { ...profile };
    const relatedByTag = await this.getRelatedTagsForMany(tags, EXPAND_TOP);
    for (const tag of tags) {
      const weight = profile[tag];
      const related = relatedByTag.get(tag) ?? [];
      if (related.length === 0) continue;
      const topHits = related[0].hits || 1;
      for (const { tagId: other, hits } of related) {
        if (other in profile) continue;
        const strength = hits / topHits;
        expanded[other] = Math.max(expanded[other] ?? 0, weight * strength * EXPAND_WEIGHT);
      }
    }
    return expanded;
  }

  async scoreCard(
    profile: Record<string, number>,
    card: Card,
    freshness = 0,
  ): Promise<{ score: number; reasonTags: string[] }> {
    const cardTags = card.tags;
    if (cardTags.length === 0 || Object.keys(profile).length === 0) {
      return { score: 0, reasonTags: [] };
    }

    let dot = 0;
    const hits: string[] = [];
    for (const tag of cardTags) {
      const interest = profile[tag];
      if (!interest) continue;
      const weight = this.tagWeight(tag);
      dot += interest * weight;
      if (interest >= OWN_CARD_WEIGHT) hits.push(tag);
    }
    if (dot <= 0) return { score: 0, reasonTags: [] };

    let cardNormSq = 0;
    for (const tag of cardTags) {
      const w = this.tagWeight(tag);
      cardNormSq += w * w;
    }
    const cardNorm = Math.sqrt(cardNormSq);
    const profileNorm = Math.sqrt(Object.values(profile).reduce((s, w) => s + w * w, 0));
    if (cardNorm <= 0 || profileNorm <= 0) return { score: 0, reasonTags: [] };

    const score = dot / (cardNorm * profileNorm) + FRESH_BONUS * freshness;
    return { score, reasonTags: hits };
  }

  async rank(
    cards: Card[],
    profile: FeedProfile,
    limit: number,
    newestAt?: string,
  ): Promise<RankedCard[]> {
    const base = this.buildProfile(profile);
    const expanded = await this.expandProfile(base);

    const allTagIds = new Set<string>(Object.keys(expanded));
    for (const card of cards) {
      for (const tag of card.tags) allTagIds.add(tag);
    }
    await this.loadTagWeights(allTagIds);

    const newestMs = newestAt ? new Date(newestAt).getTime() : Date.now();
    const oldestMs = cards.reduce(
      (min, c) => Math.min(min, new Date(c.createdAt).getTime()),
      newestMs,
    );
    const span = Math.max(newestMs - oldestMs, 1);

    const scored: RankedCard[] = [];
    for (const card of cards) {
      const freshness = (new Date(card.createdAt).getTime() - oldestMs) / span;
      const { score, reasonTags } = await this.scoreCard(expanded, card, freshness);
      scored.push({ card, score, reasonTags });
    }

    scored.sort((a, b) => b.score - a.score || b.card.createdAt.localeCompare(a.card.createdAt));
    return scored.slice(0, limit);
  }
}
