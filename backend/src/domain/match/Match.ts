export type MatchStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "COMPLETED";

export interface MatchProps {
  id: string;
  cardAId: string;
  cardBId: string;
  userAId: string;
  userBId: string;
  matchedTags: string[];
  matchedLabels?: string[];
  matchCount: number;
  distanceKm?: number;
  acceptedA?: boolean;
  acceptedB?: boolean;
  lastMessageAt?: string;
  lastMessageBy?: string;
  lastMessagePreview?: string;
  status: MatchStatus;
  createdAt: string;
}

export class Match {
  constructor(private props: MatchProps) {}

  get id(): string {
    return this.props.id;
  }
  get cardAId(): string {
    return this.props.cardAId;
  }
  get cardBId(): string {
    return this.props.cardBId;
  }
  get userAId(): string {
    return this.props.userAId;
  }
  get userBId(): string {
    return this.props.userBId;
  }
  get matchedTags(): string[] {
    return [...this.props.matchedTags];
  }
  get matchedLabels(): string[] {
    return [...(this.props.matchedLabels ?? this.props.matchedTags)];
  }
  get matchCount(): number {
    return this.props.matchCount;
  }
  get distanceKm(): number | undefined {
    return this.props.distanceKm;
  }
  get acceptedA(): boolean {
    return !!this.props.acceptedA;
  }
  get acceptedB(): boolean {
    return !!this.props.acceptedB;
  }
  get lastMessageAt(): string | undefined {
    return this.props.lastMessageAt;
  }
  get lastMessageBy(): string | undefined {
    return this.props.lastMessageBy;
  }
  get lastMessagePreview(): string | undefined {
    return this.props.lastMessagePreview;
  }
  get status(): MatchStatus {
    return this.props.status;
  }
  get createdAt(): string {
    return this.props.createdAt;
  }

  /** actor が承諾したことを記録する。両者そろえば true (=成立) を返す。 */
  acceptBy(userId: string): boolean {
    if (userId === this.props.userAId) this.props.acceptedA = true;
    else if (userId === this.props.userBId) this.props.acceptedB = true;
    const both = !!this.props.acceptedA && !!this.props.acceptedB;
    if (both) this.props.status = "ACCEPTED";
    return both;
  }

  accept(): void {
    this.props.status = "ACCEPTED";
  }

  decline(): void {
    this.props.status = "DECLINED";
  }

  complete(): void {
    this.props.status = "COMPLETED";
  }

  recordMessage(senderId: string, at: string, preview: string): void {
    this.props.lastMessageAt = at;
    this.props.lastMessageBy = senderId;
    this.props.lastMessagePreview = preview;
  }

  partnerOf(userId: string): string {
    return userId === this.props.userAId ? this.props.userBId : this.props.userAId;
  }

  isParty(userId: string): boolean {
    return userId === this.props.userAId || userId === this.props.userBId;
  }

  toProps(): MatchProps {
    return {
      ...this.props,
      matchedTags: [...this.props.matchedTags],
      matchedLabels: [...(this.props.matchedLabels ?? this.props.matchedTags)],
    };
  }

  static createId(cardAId: string, cardBId: string): string {
    const [first, second] = [cardAId, cardBId].sort();
    return `${first}_${second}`;
  }

  static create(
    cardAId: string,
    cardBId: string,
    userAId: string,
    userBId: string,
    matchedTags: string[],
    options?: { matchedLabels?: string[]; distanceKm?: number },
  ): Match {
    const id = Match.createId(cardAId, cardBId);
    return new Match({
      id,
      cardAId,
      cardBId,
      userAId,
      userBId,
      matchedTags,
      matchedLabels: options?.matchedLabels ?? matchedTags,
      matchCount: matchedTags.length,
      distanceKm: options?.distanceKm,
      acceptedA: false,
      acceptedB: false,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    });
  }
}
