import { Card } from "../card/Card";
import { Match } from "./Match";
import { User } from "../user/User";

export interface MatchEvaluationResult {
  match: Match;
  notifyOwner: boolean;
  notifyTarget: boolean;
}

export class MatchingEngine {
  /**
   * giveCard が wantCard の求める条件を満たすか（一方向判定）。満たせば一致タグを返す。
   * 環状交換（CycleFinder）のような「渡す→受け取る」の単方向評価に使う。
   */
  static satisfies(wantCard: Card, giveCard: Card): string[] | null {
    if (wantCard.type !== "WANT" || !wantCard.isOpen()) return null;
    if (giveCard.type !== "GIVE" || !giveCard.isOpen()) return null;
    if (wantCard.ownerId === giveCard.ownerId) return null;

    const giveTags = new Set(giveCard.tags);
    const matched = wantCard.tags.filter((t) => giveTags.has(t));

    if (matched.length < wantCard.minMatchCount) return null;
    if (!wantCard.requiredTags.every((t) => giveTags.has(t))) return null;

    if (wantCard.dates.length > 0 && giveCard.dates.length > 0) {
      const hasCommonDate = wantCard.dates.some((d) => giveCard.dates.includes(d));
      if (!hasCommonDate) return null;
    }

    return matched;
  }

  static evaluate(
    card: Card,
    targetCard: Card,
    matchedTags: string[],
    ownerUser?: User,
    targetUser?: User,
  ): MatchEvaluationResult | null {
    // 1. 除外ルール (同一ユーザー、またはどちらかのユーザーが停止中)
    if (card.ownerId === targetCard.ownerId) return null;
    if (ownerUser?.isSuspended() || targetUser?.isSuspended()) return null;
    if (!card.isOpen() || !targetCard.isOpen()) return null;

    // 2. カードタイプ適合
    if (!card.isCounterpart(targetCard.type)) return null;

    // 3. 必須タグ判定 (requiredTags)
    const targetTagSet = new Set(targetCard.tags);
    for (const reqTag of card.requiredTags) {
      if (!targetTagSet.has(reqTag)) return null;
    }
    const cardTagSet = new Set(card.tags);
    for (const reqTag of targetCard.requiredTags) {
      if (!cardTagSet.has(reqTag)) return null;
    }

    // 4. ハードコンディション判定 (日程 dates の積集合)
    if (card.dates.length > 0 && targetCard.dates.length > 0) {
      const hasCommonDate = card.dates.some((d) => targetCard.dates.includes(d));
      if (!hasCommonDate) return null;
    }

    // 5. しきい値の評価 (双方向)
    const matchCount = matchedTags.length;
    const notifyOwner = matchCount >= card.minMatchCount;
    const notifyTarget = matchCount >= targetCard.minMatchCount;

    if (!notifyOwner && !notifyTarget) return null;

    const labels = { ...targetCard.tagLabels, ...card.tagLabels };
    const matchedLabels = matchedTags.map((t) => labels[t] ?? t);

    const cardLoc = card.location;
    const targetLoc = targetCard.location;
    const distanceKm = cardLoc && targetLoc ? cardLoc.distanceKm(targetLoc) : undefined;

    const match = Match.create(
      card.id,
      targetCard.id,
      card.ownerId,
      targetCard.ownerId,
      matchedTags,
      {
        matchedLabels,
        distanceKm,
      },
    );

    return {
      match,
      notifyOwner,
      notifyTarget,
    };
  }
}
