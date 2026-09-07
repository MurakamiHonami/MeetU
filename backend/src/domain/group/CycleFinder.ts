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
 *
 * 探索は鎖長（=グラフ上の深さ）ごとに幅優先で進める。各階層に登場するユーザー・カードをまとめて
 * バッチ取得することで、鎖の本数に比例してD1往復が増えないようにしている（ノード単位・辺単位の
 * 逐次 await だと MAX_VISITS まで積み重なりうるため）。
 */
export class CycleFinder {
  constructor(private cardRepo: ICardRepository) {}

  private giveCardCache = new Map<string, Card[]>();
  private edgeCache = new Map<string, Edge[]>();

  /** 未キャッシュのユーザーの譲カードをまとめて取得し、キャッシュへ反映する。 */
  private async loadGiveCards(userIds: string[]): Promise<void> {
    const uncached = [...new Set(userIds)].filter((id) => !this.giveCardCache.has(id));
    if (uncached.length === 0) return;

    const cards = await this.cardRepo.findByOwnerIds(uncached);
    const byOwner = new Map<string, Card[]>();
    for (const card of cards) {
      if (card.type !== "GIVE" || !card.isOpen()) continue;
      const list = byOwner.get(card.ownerId);
      if (list) list.push(card);
      else byOwner.set(card.ownerId, [card]);
    }
    for (const userId of uncached) {
      this.giveCardCache.set(userId, byOwner.get(userId) ?? []);
    }
  }

  /** 未キャッシュの譲カード群について、辿れる辺（求カード）をまとめて取得しキャッシュへ反映する。 */
  private async loadEdges(giveCards: Card[]): Promise<void> {
    const uncached = giveCards.filter((c) => !this.edgeCache.has(c.id));
    if (uncached.length === 0) return;

    const allTags = [...new Set(uncached.flatMap((c) => c.tags))];
    const hits = await this.cardRepo.findCandidateCardIdsByTags(allTags, "WANT");
    const hitsByTag = new Map<string, { cardId: string; ownerId: string }[]>();
    for (const hit of hits) {
      const list = hitsByTag.get(hit.tagId);
      if (list) list.push(hit);
      else hitsByTag.set(hit.tagId, [hit]);
    }

    const candidateIdsByCard = new Map<string, Set<string>>();
    const allCandidateIds = new Set<string>();
    for (const giveCard of uncached) {
      const ids = new Set<string>();
      for (const tag of giveCard.tags) {
        for (const hit of hitsByTag.get(tag) ?? []) {
          if (hit.ownerId === giveCard.ownerId) continue;
          ids.add(hit.cardId);
          allCandidateIds.add(hit.cardId);
        }
      }
      candidateIdsByCard.set(giveCard.id, ids);
    }

    const wantCards = await this.cardRepo.findByIds(Array.from(allCandidateIds));
    const wantCardById = new Map(wantCards.map((c) => [c.id, c]));

    for (const giveCard of uncached) {
      const edges: Edge[] = [];
      for (const id of candidateIdsByCard.get(giveCard.id) ?? []) {
        const wantCard = wantCardById.get(id);
        if (!wantCard) continue;
        const matched = MatchingEngine.satisfies(wantCard, giveCard);
        if (matched) edges.push({ wantCard, matchedTags: matched });
      }
      edges.sort((a, b) => b.matchedTags.length - a.matchedTags.length);
      this.edgeCache.set(giveCard.id, edges.slice(0, MAX_BRANCH));
    }
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

    await this.loadEdges([startCard]);
    let frontier: TradeStep[][] = [];
    for (const edge of this.edgeCache.get(startCard.id) ?? []) {
      if (edge.wantCard.ownerId === startUser) continue;
      frontier.push([this.toStep(startCard, edge)]);
    }

    // 鎖長が同じ（=同じ階層の）鎖をまとめて処理し、必要なD1往復を階層ごとに1回にまとめる。
    while (frontier.length > 0 && found.size < limit && visits.count < MAX_VISITS) {
      if (frontier[0].length >= maxLen) break;

      await this.loadGiveCards(frontier.map((chain) => chain[chain.length - 1].toUserId));

      const pending: { chain: TradeStep[]; giveCard: Card }[] = [];
      outer: for (const chain of frontier) {
        const currentUser = chain[chain.length - 1].toUserId;
        for (const giveCard of this.giveCardCache.get(currentUser) ?? []) {
          if (visits.count >= MAX_VISITS) break outer;
          visits.count += 1;
          pending.push({ chain, giveCard });
        }
      }

      await this.loadEdges(pending.map((p) => p.giveCard));

      const nextFrontier: TradeStep[][] = [];
      for (const { chain, giveCard } of pending) {
        const usedUsers = new Set(chain.map((s) => s.fromUserId));
        for (const edge of this.edgeCache.get(giveCard.id) ?? []) {
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

          nextFrontier.push([...chain, step]);
        }
      }
      frontier = nextFrontier;
    }

    // 短い輪ほど成立しやすいので前に出す
    return Array.from(found.values())
      .sort((a, b) => a.length - b.length)
      .slice(0, limit);
  }
}
