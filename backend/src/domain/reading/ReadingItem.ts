import { ValidationError } from "../shared/DomainError";

export type ReadingStatus = "UNREAD" | "READING" | "DONE";

const STATUSES: ReadingStatus[] = ["UNREAD", "READING", "DONE"];

export interface ReadingItemProps {
  id: string;
  ownerId: string;
  isbn?: string;
  title: string;
  author?: string;
  coverUrl?: string;
  status: ReadingStatus;
  note?: string;
  /** 読了→譲る連携で作った交換カードの id。未出品なら undefined。 */
  cardId?: string;
  createdAt: string;
  updatedAt: string;
}

export class ReadingItem {
  constructor(private props: ReadingItemProps) {}

  get id(): string {
    return this.props.id;
  }
  get ownerId(): string {
    return this.props.ownerId;
  }
  get isbn(): string | undefined {
    return this.props.isbn;
  }
  get title(): string {
    return this.props.title;
  }
  get author(): string | undefined {
    return this.props.author;
  }
  get coverUrl(): string | undefined {
    return this.props.coverUrl;
  }
  get status(): ReadingStatus {
    return this.props.status;
  }
  get note(): string | undefined {
    return this.props.note;
  }
  get cardId(): string | undefined {
    return this.props.cardId;
  }
  get createdAt(): string {
    return this.props.createdAt;
  }
  get updatedAt(): string {
    return this.props.updatedAt;
  }

  isListedForTrade(): boolean {
    return !!this.props.cardId;
  }

  changeStatus(status: ReadingStatus): void {
    this.props.status = status;
    this.touch();
  }

  edit(input: { title?: string; author?: string; note?: string }): void {
    if (input.title !== undefined) {
      const title = input.title.trim();
      if (!title) throw new ValidationError("タイトルは必須です");
      this.props.title = title.slice(0, 200);
    }
    if (input.author !== undefined)
      this.props.author = input.author.trim().slice(0, 100) || undefined;
    if (input.note !== undefined) this.props.note = input.note.trim().slice(0, 500) || undefined;
    this.touch();
  }

  /** 読了→譲る連携で作った交換カードを紐付ける。 */
  linkTradeCard(cardId: string): void {
    this.props.cardId = cardId;
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date().toISOString();
  }

  toProps(): ReadingItemProps {
    return { ...this.props };
  }

  static create(input: {
    ownerId: string;
    isbn?: string;
    title: string;
    author?: string;
    coverUrl?: string;
    status?: ReadingStatus;
    note?: string;
  }): ReadingItem {
    const title = input.title.trim();
    if (!title) throw new ValidationError("タイトルは必須です");
    const status = input.status ?? "UNREAD";
    if (!STATUSES.includes(status)) {
      throw new ValidationError("status は UNREAD / READING / DONE のいずれかです");
    }
    const now = new Date().toISOString();
    return new ReadingItem({
      id: crypto.randomUUID(),
      ownerId: input.ownerId,
      isbn: input.isbn?.trim() || undefined,
      title: title.slice(0, 200),
      author: input.author?.trim().slice(0, 100) || undefined,
      coverUrl: input.coverUrl?.trim() || undefined,
      status,
      note: input.note?.trim().slice(0, 500) || undefined,
      createdAt: now,
      updatedAt: now,
    });
  }
}
