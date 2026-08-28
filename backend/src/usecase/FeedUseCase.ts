import { ICardRepository } from "../domain/card/ICardRepository";
import { ITagRepository } from "../domain/tag/ITagRepository";
import { ISwipeRepository } from "../domain/feed/ISwipeRepository";
import { IUserRepository } from "../domain/user/IUserRepository";
import { FeedRanker } from "../domain/feed/FeedRanker";
import { Card } from "../domain/card/Card";
import { NotFoundError, ForbiddenError } from "../domain/shared/DomainError";

const FEED_LIMIT = 30;
const FEED_DAYS = 7;

export class FeedUseCase {
  private ranker: FeedRanker;

  constructor(
    private cardRepo: ICardRepository,
    private tagRepo: ITagRepository,
    private swipeRepo: ISwipeRepository,
    private userRepo: IUserRepository,
  ) {
    this.ranker = new FeedRanker(
      (id) => this.tagRepo.findById(id),
      (id, limit) => this.tagRepo.findRelatedTags(id, limit),
    );
  }

  async getFeed(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError("ユーザーが見つかりません");

    const swiped = await this.swipeRepo.findSwipedCardIds(userId);
    const candidates = (await this.cardRepo.findRecentOpen(FEED_DAYS, 200)).filter(
      (c) => c.isOpen() && c.ownerId !== userId && !swiped.has(c.id),
    );

    const ownCards = await this.cardRepo.findByOwnerId(userId);
    const ownCardTags = ownCards.filter((c) => c.isOpen()).flatMap((c) => c.tags);

    const ranked = await this.ranker.rank(
      candidates,
      { favoriteTags: user.favoriteTags, ownCardTags },
      FEED_LIMIT,
    );

    return {
      cards: ranked,
      hasFavorites: user.favoriteTags.length > 0,
    };
  }

  async saveCard(userId: string, cardId: string): Promise<void> {
    const card = await this.cardRepo.findById(cardId);
    if (!card) throw new NotFoundError("カードが見つかりません");
    if (card.ownerId === userId) throw new ForbiddenError("自分のカードは操作できません");
    await this.swipeRepo.record(userId, cardId, "save");
  }

  async skipCard(userId: string, cardId: string): Promise<void> {
    const card = await this.cardRepo.findById(cardId);
    if (!card) throw new NotFoundError("カードが見つかりません");
    if (card.ownerId === userId) throw new ForbiddenError("自分のカードは操作できません");
    await this.swipeRepo.record(userId, cardId, "skip");
  }

  async getSavedCards(userId: string): Promise<Card[]> {
    const ids = await this.swipeRepo.findSavedCardIds(userId);
    return this.cardRepo.findByIds(ids);
  }

  async unsaveCard(userId: string, cardId: string): Promise<boolean> {
    return this.swipeRepo.removeSaved(userId, cardId);
  }
}
