import { Review } from "./Review";

export interface IReviewRepository {
  /** 同じマッチ・同じ投稿者の評価が既にあるか（1マッチにつき1回だけ）。 */
  existsForMatch(matchId: string, fromUserId: string): Promise<boolean>;
  findByToUserId(userId: string, limit?: number): Promise<Review[]>;
  save(review: Review): Promise<void>;
}
