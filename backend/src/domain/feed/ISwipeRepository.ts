import { Swipe, SwipeAction } from './Swipe';

export interface ISwipeRepository {
  record(userId: string, cardId: string, action: SwipeAction): Promise<void>;
  findSwipedCardIds(userId: string): Promise<Set<string>>;
  findSavedCardIds(userId: string): Promise<string[]>;
  removeSaved(userId: string, cardId: string): Promise<boolean>;
}
