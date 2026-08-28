export type SwipeAction = 'save' | 'skip';

export interface SwipeProps {
  userId: string;
  cardId: string;
  action: SwipeAction;
  createdAt: string;
}

export class Swipe {
  constructor(private props: SwipeProps) {}

  get userId(): string { return this.props.userId; }
  get cardId(): string { return this.props.cardId; }
  get action(): SwipeAction { return this.props.action; }
  get createdAt(): string { return this.props.createdAt; }

  toProps(): SwipeProps {
    return { ...this.props };
  }

  static create(userId: string, cardId: string, action: SwipeAction): Swipe {
    return new Swipe({ userId, cardId, action, createdAt: new Date().toISOString() });
  }
}
