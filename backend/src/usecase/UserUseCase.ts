import { IUserRepository } from '../domain/user/IUserRepository';
import { ICardRepository } from '../domain/card/ICardRepository';
import { IReviewRepository } from '../domain/review/IReviewRepository';
import { User } from '../domain/user/User';
import { Location, LocationProps } from '../domain/shared/Location';
import { TagNormalizer } from '../domain/tag/TagNormalizer';

export class UserUseCase {
  constructor(
    private userRepo: IUserRepository,
    private cardRepo: ICardRepository,
    private reviewRepo: IReviewRepository
  ) {}

  async getUserById(id: string): Promise<User | null> {
    return this.userRepo.findById(id);
  }

  async getProfile(id: string): Promise<{ user: User; cardCount: number } | null> {
    const user = await this.userRepo.findById(id);
    if (!user) return null;
    const cards = await this.cardRepo.findByOwnerId(id);
    return { user, cardCount: cards.filter((c) => c.isOpen()).length };
  }

  async updateProfile(id: string, displayName: string, pictureUrl?: string): Promise<User | null> {
    const user = await this.userRepo.findById(id);
    if (!user) return null;
    user.updateProfile(displayName, pictureUrl);
    await this.userRepo.update(user);
    return user;
  }

  async updateFavorites(id: string, favorites: { name: string }[]): Promise<User | null> {
    const user = await this.userRepo.findById(id);
    if (!user) return null;
    const tagIds: string[] = [];
    const labels: Record<string, string> = {};
    for (const f of favorites) {
      const tagId = TagNormalizer.normalize(f.name);
      tagIds.push(tagId);
      labels[tagId] = f.name;
    }
    user.setFavorites(tagIds, labels);
    await this.userRepo.update(user);
    return user;
  }

  async updateHome(id: string, homeLocation: LocationProps | null): Promise<User | null> {
    const user = await this.userRepo.findById(id);
    if (!user) return null;
    const loc = homeLocation ? new Location(homeLocation) : undefined;
    user.setHomeLocation(loc);
    await this.userRepo.update(user);
    return user;
  }

  async getMyReviews(id: string) {
    const reviews = await this.reviewRepo.findByToUserId(id);
    return reviews.map((r) => ({
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
    }));
  }
}
