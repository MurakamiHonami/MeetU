import { Card, CardType } from "./Card";

export interface CardTagHit {
  cardId: string;
  tagId: string;
  ownerId: string;
}

export interface ICardRepository {
  findById(id: string): Promise<Card | null>;
  findByOwnerId(ownerId: string): Promise<Card[]>;
  findCandidateCardIdsByTags(
    tagIds: string[],
    targetType: CardType | readonly CardType[],
  ): Promise<CardTagHit[]>;
  /** 新着フィード用。直近 days 日以内に作成された OPEN カードを新しい順に返す。 */
  findRecentOpen(days: number, limit: number): Promise<Card[]>;
  /** 近傍検索用。指定した geohash セル群に含まれる OPEN カードを返す。 */
  findByGeohashCells(cells: string[]): Promise<Card[]>;
  findByIds(ids: string[]): Promise<Card[]>;
  searchByTags(tagIds: string[], minMatch: number, type?: CardType): Promise<Card[]>;
  save(card: Card): Promise<void>;
  updateStatus(id: string, status: Card["status"]): Promise<void>;
  delete(id: string): Promise<void>;
}
