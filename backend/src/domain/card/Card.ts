import { Location, LocationProps } from '../shared/Location';

export type CardType = 'GIVE' | 'WANT' | 'COMPANION';
export type CardStatus = 'OPEN' | 'CLOSED' | 'MATCHED';

export interface CardProps {
  id: string;
  ownerId: string;
  type: CardType;
  title: string;
  note?: string;
  minMatchCount: number;
  tags: string[]; // tagIds
  tagLabels?: Record<string, string>; // tagId -> displayName
  requiredTags: string[]; // tagIds
  dates: string[];
  location?: LocationProps;
  status: CardStatus;
  createdAt: string;
  expiresAt: string;
}

export class Card {
  constructor(private props: CardProps) {}

  get id(): string { return this.props.id; }
  get ownerId(): string { return this.props.ownerId; }
  get type(): CardType { return this.props.type; }
  get title(): string { return this.props.title; }
  get note(): string | undefined { return this.props.note; }
  get minMatchCount(): number { return this.props.minMatchCount; }
  get tags(): string[] { return [...this.props.tags]; }
  get tagLabels(): Record<string, string> { return { ...(this.props.tagLabels ?? {}) }; }
  get requiredTags(): string[] { return [...this.props.requiredTags]; }
  get dates(): string[] { return [...this.props.dates]; }
  get location(): Location | undefined {
    return this.props.location ? new Location(this.props.location) : undefined;
  }
  get status(): CardStatus { return this.props.status; }
  get createdAt(): string { return this.props.createdAt; }
  get expiresAt(): string { return this.props.expiresAt; }

  isOpen(): boolean {
    if (this.props.status !== 'OPEN') return false;
    if (new Date(this.props.expiresAt).getTime() <= Date.now()) return false;
    return true;
  }

  close(): void {
    this.props.status = 'CLOSED';
  }

  isCounterpart(otherType: CardType): boolean {
    if (this.props.type === 'COMPANION') return otherType === 'COMPANION';
    if (this.props.type === 'GIVE') return otherType === 'WANT';
    if (this.props.type === 'WANT') return otherType === 'GIVE';
    return false;
  }

  toProps(): CardProps {
    return {
      ...this.props,
      tags: [...this.props.tags],
      tagLabels: { ...(this.props.tagLabels ?? {}) },
      requiredTags: [...this.props.requiredTags],
      dates: [...this.props.dates],
    };
  }

  static create(props: Omit<CardProps, 'id' | 'status' | 'createdAt' | 'expiresAt'>): Card {
    const id = crypto.randomUUID();
    const now = new Date();
    const expires = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days TTL

    return new Card({
      ...props,
      id,
      status: 'OPEN',
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
    });
  }
}
