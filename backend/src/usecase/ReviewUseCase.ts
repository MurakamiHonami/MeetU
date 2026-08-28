import { IReviewRepository } from "../domain/review/IReviewRepository";
import { IMatchRepository } from "../domain/match/IMatchRepository";
import { IUserRepository } from "../domain/user/IUserRepository";
import { Review } from "../domain/review/Review";

export class ReviewUseCase {
  constructor(
    private reviewRepo: IReviewRepository,
    private matchRepo: IMatchRepository,
    private userRepo: IUserRepository,
  ) {}

  async createReview(input: {
    matchId: string;
    fromUserId: string;
    rating: number;
    comment?: string;
  }) {
    const match = await this.matchRepo.findById(input.matchId);
    if (!match) throw new Error("マッチが見つかりません");
    if (!match.isParty(input.fromUserId)) throw new Error("このマッチの当事者ではありません");
    if (match.status !== "COMPLETED") throw new Error("交換完了後に評価できます");

    const exists = await this.reviewRepo.existsForMatch(input.matchId, input.fromUserId);
    if (exists) throw new Error("このマッチには既に評価済みです");

    const toUserId = match.partnerOf(input.fromUserId);
    const review = Review.create({
      matchId: input.matchId,
      fromUserId: input.fromUserId,
      toUserId,
      rating: input.rating,
      comment: input.comment,
    });

    await this.reviewRepo.save(review);

    const target = await this.userRepo.findById(toUserId);
    if (target) {
      target.applyReview(input.rating);
      await this.userRepo.update(target);
    }

    return review;
  }
}
