import { ReadingItem, ReadingStatus } from "./ReadingItem";

export interface IReadingItemRepository {
  findById(id: string): Promise<ReadingItem | null>;
  /** owner の積読リスト。status 指定で絞り込み、新しい順。 */
  findByOwner(ownerId: string, status?: ReadingStatus): Promise<ReadingItem[]>;
  /** owner が同じ ISBN を既に登録しているか（重複登録の防止）。 */
  existsByOwnerAndIsbn(ownerId: string, isbn: string): Promise<boolean>;
  save(item: ReadingItem): Promise<void>;
  update(item: ReadingItem): Promise<void>;
  delete(id: string): Promise<void>;
}
