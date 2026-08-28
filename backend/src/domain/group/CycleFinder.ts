import { Card } from "../card/Card";
import { ICardRepository } from "../card/ICardRepository";
import { MatchingEngine } from "../match/MatchingEngine";
import { TradeStep } from "./TradeGroup";

const MAX_CYCLE = 4; // 4人までの輪を探す
const MIN_CYCLE = 3; // 2人の交換は通常のマッチが扱うので3人から
const MAX_BRANCH = 5; // 1ノードから辿る辺の上限（一致数の多い順）
const MAX_VISITS = 300; // 探索全体の打ち切り
const MAX_RESULTS = 5; // 1回の登録で提案する輪の数

interface Edge {
  wantCard: Card;
  matchedTags: string[];
}

/**
 * 環状交換（3人以上での持ち回り交換）の検出。
 *
 * 1対1では成立しない組み合わせでも、輪にすれば全員の希望が満たせることがある。
 * 有向グラフの閉路探索として解く: ノード=ユーザー、辺 X→Y = X が出せるカードが Y の求める条件を満たす。
 * 探索は深さ・分岐・訪問数に上限を設けて打ち切る（全閉路の列挙は組合せ爆発するため）。
 */
export class CycleFinder {
  constructor(private cardRepo: ICardRepository) {}

  private giveCardCache = new Map<string, Card[]>();
  private edgeCache = new Map<string, Edge[]>();

  private async openGiveCards(userId: string): Promise<Card[]> {
    const cached = this.giveCardCache.get(userId);
    if (cached) return cached;
    const cards = (await this.cardRepo.findByOwnerId(userId)).filter(
      (c) => c.type === "GIVE" && c.isOpen(),
    );
    this.giveCardCache.set(userId, cards);
    return cards;
  }

  /** この譲カードを受け取れる相手（求カード）の辺。 */
  private async outgoing(giveCard: Card): Promise<Edge[]> {
    const cached = this.edgeCache.get(giveCard.id);
    if (cached) return cached;

    const hits = await this.cardRepo.findCandidateCardIdsByTags(giveCard.tags, "WANT");
    const candidateIds = new Set(
      hits.filter((h) => h.ownerId !== giveCard.ownerId).map((h) => h.cardId),
    );

    const edges: Edge[] = [];
    for (const cardId of candidateIds) {
      const wantCard = await this.cardRepo.findById(cardId);
      if (!wantCard) continue;
      const matched = MatchingEngine.satisfies(wantCard, giveCard);
      if (matched) edges.push({ wantCard, matchedTags: matched });
    }

    edges.sort((a, b) => b.matchedTags.length - a.matchedTags.length);
    const limited = edges.slice(0, MAX_BRANCH);
    this.edgeCache.set(giveCard.id, limited);
    return limited;
  }

  private toStep(giveCard: Card, edge: Edge): TradeStep {
    const labels = { ...edge.wantCard.tagLabels, ...giveCard.tagLabels };
    return {
      fromUserId: giveCard.ownerId,
      toUserId: edge.wantCard.ownerId,
      giveCardId: giveCard.id,
      wantCardId: edge.wantCard.id,
      matchedTags: edge.matchedTags,
      matchedLabels: edge.matchedTags.map((t) => labels[t] ?? t),
      matchCount: edge.matchedTags.length,
    };
  }

  /** startCard（譲カード）の持ち主を起点に、閉じた交換の輪を探す。 */
  async findCycles(
    startCard: Card,
    maxLen = MAX_CYCLE,
    limit = MAX_RESULTS,
  ): Promise<TradeStep[][]> {
    if (startCard.type !== "GIVE" || !startCard.isOpen()) return [];

    const startUser = startCard.ownerId;
    this.giveCardCache.set(startUser, [startCard]);

    const visits = { count: 0 };
    const found = new Map<string, TradeStep[]>();

    const walk = async (chain: TradeStep[]): Promise<void> => {
      if (found.size >= limit || visits.count >= MAX_VISITS) return;
      if (chain.length >= maxLen) return;

      const currentUser = chain[chain.length - 1].toUserId;
      const usedUsers = new Set(chain.map((s) => s.fromUserId));

      for (const giveCard of await this.openGiveCards(currentUser)) {
        if (visits.count >= MAX_VISITS) return;
        visits.count += 1;

        for (const edge of await this.outgoing(giveCard)) {
          const receiver = edge.wantCard.ownerId;
          const step = this.toStep(giveCard, edge);

          if (receiver === startUser) {
            const closed = [...chain, step];
            if (closed.length >= MIN_CYCLE) {
              const groupId = closed
                .map((s) => s.giveCardId)
                .sort()
                .join("_");
              if (!found.has(groupId)) found.set(groupId, closed);
            }
            continue;
          }
          if (usedUsers.has(receiver)) continue; // 同じ人を二度通らない

          await walk([...chain, step]);
        }
      }
    };

    for (const edge of await this.outgoing(startCard)) {
      if (edge.wantCard.ownerId === startUser) continue;
      await walk([this.toStep(startCard, edge)]);
    }

    // 短い輪ほど成立しやすいので前に出す
    return Array.from(found.values())
      .sort((a, b) => a.length - b.length)
      .slice(0, limit);
  }
}
