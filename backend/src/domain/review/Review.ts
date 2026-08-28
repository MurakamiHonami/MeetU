import { ValidationError } from "../shared/DomainError";

export interface ReviewProps {
  id: string;
  matchId: string;
  fromUserId: string;
  toUserId: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export class Review {
  constructor(private props: ReviewProps) {}

  get id(): string {
    return this.props.id;
  }
  get matchId(): string {
    return this.props.matchId;
  }
  get fromUserId(): string {
    return this.props.fromUserId;
  }
  get toUserId(): string {
    return this.props.toUserId;
  }
  get rating(): number {
    return this.props.rating;
  }
  get comment(): string | undefined {
    return this.props.comment;
  }
  get createdAt(): string {
    return this.props.createdAt;
  }

  toProps(): ReviewProps {
    return { ...this.props };
  }

  static create(input: {
    matchId: string;
    fromUserId: string;
    toUserId: string;
    rating: number;
    comment?: string;
  }): Review {
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      throw new ValidationError("rating は 1〜5 で指定してください");
    }
    return new Review({
      id: crypto.randomUUID(),
      matchId: input.matchId,
      fromUserId: input.fromUserId,
      toUserId: input.toUserId,
      rating: input.rating,
      comment: input.comment?.trim().slice(0, 200) || undefined,
      createdAt: new Date().toISOString(),
    });
  }
}
