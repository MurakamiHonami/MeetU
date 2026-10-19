import { IReadingItemRepository } from "../domain/reading/IReadingItemRepository";
import { ReadingItem, ReadingStatus } from "../domain/reading/ReadingItem";
import { ConflictError, ForbiddenError, NotFoundError } from "../domain/shared/DomainError";
import { CardUseCase, CreateCardResult } from "./CardUseCase";

export class ReadingUseCase {
  constructor(
    private readingRepo: IReadingItemRepository,
    private cardUseCase: CardUseCase,
  ) {}

  async list(ownerId: string, status?: ReadingStatus): Promise<ReadingItem[]> {
    return this.readingRepo.findByOwner(ownerId, status);
  }

  async add(input: {
    ownerId: string;
    isbn?: string;
    title: string;
    author?: string;
    coverUrl?: string;
    status?: ReadingStatus;
    note?: string;
  }): Promise<ReadingItem> {
    const isbn = input.isbn?.trim();
    if (isbn && (await this.readingRepo.existsByOwnerAndIsbn(input.ownerId, isbn))) {
      throw new ConflictError("この本は既に本棚に登録されています");
    }
    const item = ReadingItem.create({ ...input, isbn });
    await this.readingRepo.save(item);
    return item;
  }

  async changeStatus(ownerId: string, itemId: string, status: ReadingStatus): Promise<ReadingItem> {
    const item = await this.loadOwned(ownerId, itemId);
    item.changeStatus(status);
    await this.readingRepo.update(item);
    return item;
  }

  async edit(
    ownerId: string,
    itemId: string,
    input: { title?: string; author?: string; note?: string },
  ): Promise<ReadingItem> {
    const item = await this.loadOwned(ownerId, itemId);
    item.edit(input);
    await this.readingRepo.update(item);
    return item;
  }

  async remove(ownerId: string, itemId: string): Promise<void> {
    const item = await this.loadOwned(ownerId, itemId);
    await this.readingRepo.delete(item.id);
  }

  /**
   * 読了→譲る連携。本棚の 1 冊から【譲】の交換カードを作る。
   * 既に出品済みなら拒否し、作成後は本に cardId を紐付ける。
   */
  async listForTrade(
    ownerId: string,
    itemId: string,
    input: { tags: { displayName: string; category?: string }[]; note?: string },
  ): Promise<{ item: ReadingItem; trade: CreateCardResult }> {
    const item = await this.loadOwned(ownerId, itemId);
    if (item.isListedForTrade()) {
      throw new ConflictError("この本は既に譲カードを出品済みです");
    }
    const trade = await this.cardUseCase.createCard({
      ownerId,
      type: "GIVE",
      title: item.title,
      note: input.note,
      tags: input.tags,
    });
    item.linkTradeCard(trade.card.id);
    await this.readingRepo.update(item);
    return { item, trade };
  }

  private async loadOwned(ownerId: string, itemId: string): Promise<ReadingItem> {
    const item = await this.readingRepo.findById(itemId);
    if (!item) throw new NotFoundError("本が見つかりません");
    if (item.ownerId !== ownerId) throw new ForbiddenError("自分の本ではありません");
    return item;
  }
}
