import { IMatchRepository } from "../domain/match/IMatchRepository";
import { ICardRepository } from "../domain/card/ICardRepository";
import { IUserRepository } from "../domain/user/IUserRepository";
import { Match, MatchStatus } from "../domain/match/Match";
import { Card } from "../domain/card/Card";
import { User } from "../domain/user/User";
import { ConflictError } from "../domain/shared/DomainError";

export interface MatchDetail {
  match: Match;
  partner: User | null;
  partnerCard: Card | null;
  myCard: Card | null;
  iGive: Card | null;
  iReceive: Card | null;
  lastReadAt: string | null;
}

export class MatchUseCase {
  constructor(
    private matchRepo: IMatchRepository,
    private cardRepo: ICardRepository,
    private userRepo: IUserRepository,
  ) {}

  async getMyMatches(userId: string): Promise<Match[]> {
    return this.matchRepo.findByUserId(userId);
  }

  /** マッチ一覧をまとめて取得する。matchRepo/userRepo/cardRepo それぞれ1〜数クエリでN+1を避ける。 */
  async getMyMatchDetails(userId: string): Promise<MatchDetail[]> {
    const matches = (await this.matchRepo.findByUserId(userId)).filter((m) => m.isParty(userId));
    if (matches.length === 0) return [];

    const partnerIds = new Set<string>();
    const cardIds = new Set<string>();
    for (const m of matches) {
      partnerIds.add(m.partnerOf(userId));
      cardIds.add(m.cardAId);
      cardIds.add(m.cardBId);
    }

    const [partners, cards, lastReadAts] = await Promise.all([
      this.userRepo.findByIds([...partnerIds]),
      this.cardRepo.findByIds([...cardIds]),
      this.matchRepo.getLastReadAtBatch(
        matches.map((m) => m.id),
        userId,
      ),
    ]);
    const partnerById = new Map(partners.map((u) => [u.id, u]));
    const cardById = new Map(cards.map((c) => [c.id, c]));

    return matches.map((match) => {
      const partnerId = match.partnerOf(userId);
      const partner = partnerById.get(partnerId) ?? null;
      const isA = match.userAId === userId;
      const myCardId = isA ? match.cardAId : match.cardBId;
      const partnerCardId = isA ? match.cardBId : match.cardAId;
      const myCard = cardById.get(myCardId) ?? null;
      const partnerCard = cardById.get(partnerCardId) ?? null;

      let iGive: Card | null = null;
      let iReceive: Card | null = null;
      if (myCard?.type === "GIVE") iGive = myCard;
      if (myCard?.type === "WANT") iReceive = partnerCard;
      if (partnerCard?.type === "GIVE" && myCard?.type === "WANT") iReceive = partnerCard;
      if (partnerCard?.type === "WANT" && myCard?.type === "GIVE") iGive = myCard;

      const lastReadAt = lastReadAts.get(match.id) ?? null;
      return { match, partner, partnerCard, myCard, iGive, iReceive, lastReadAt };
    });
  }

  async getMatchDetail(matchId: string, userId: string): Promise<MatchDetail | null> {
    const match = await this.matchRepo.findById(matchId);
    if (!match || !match.isParty(userId)) return null;

    const partnerId = match.partnerOf(userId);
    const partner = await this.userRepo.findById(partnerId);
    const isA = match.userAId === userId;
    const myCardId = isA ? match.cardAId : match.cardBId;
    const partnerCardId = isA ? match.cardBId : match.cardAId;

    const [myCard, partnerCard] = await Promise.all([
      this.cardRepo.findById(myCardId),
      this.cardRepo.findById(partnerCardId),
    ]);

    let iGive: Card | null = null;
    let iReceive: Card | null = null;
    if (myCard?.type === "GIVE") iGive = myCard;
    if (myCard?.type === "WANT") iReceive = partnerCard;
    if (partnerCard?.type === "GIVE" && myCard?.type === "WANT") iReceive = partnerCard;
    if (partnerCard?.type === "WANT" && myCard?.type === "GIVE") iGive = myCard;

    const lastReadAt = await this.matchRepo.getLastReadAt(matchId, userId);
    return { match, partner, partnerCard, myCard, iGive, iReceive, lastReadAt };
  }

  async accept(
    matchId: string,
    userId: string,
  ): Promise<{ match: Match; bothAccepted: boolean } | null> {
    const match = await this.matchRepo.findById(matchId);
    if (!match || !match.isParty(userId)) return null;

    const bothAccepted = match.acceptBy(userId);
    await this.matchRepo.save(match);
    return { match, bothAccepted };
  }

  async decline(matchId: string, userId: string): Promise<Match | null> {
    const match = await this.matchRepo.findById(matchId);
    if (!match || !match.isParty(userId)) return null;
    match.decline();
    await this.matchRepo.save(match);
    return match;
  }

  async complete(matchId: string, userId: string): Promise<Match | null> {
    const match = await this.matchRepo.findById(matchId);
    if (!match || !match.isParty(userId)) return null;
    if (match.status !== "ACCEPTED" && match.status !== "COMPLETED") {
      throw new ConflictError("成立したマッチのみ完了にできます");
    }
    match.complete();
    await this.matchRepo.save(match);
    return match;
  }

  async updateMatchStatus(
    matchId: string,
    userId: string,
    status: MatchStatus,
  ): Promise<Match | null> {
    if (status === "ACCEPTED") return (await this.accept(matchId, userId))?.match ?? null;
    if (status === "DECLINED") return this.decline(matchId, userId);
    if (status === "COMPLETED") return this.complete(matchId, userId);
    return null;
  }
}
