import { ForbiddenError, ConflictError } from "../shared/DomainError";

export type TradeGroupStatus = "NEW" | "ACCEPTED" | "DECLINED" | "COMPLETED";
export type GroupResponse = "accept" | "decline";

export interface TradeStep {
  fromUserId: string;
  toUserId: string;
  giveCardId: string;
  wantCardId: string;
  matchedTags: string[];
  matchedLabels: string[];
  matchCount: number;
}

export interface TradeGroupProps {
  id: string;
  length: number;
  steps: TradeStep[];
  members: string[];
  responses: Record<string, GroupResponse>;
  foundBy?: string;
  lastMessageAt?: string;
  lastMessageBy?: string;
  lastMessagePreview?: string;
  status: TradeGroupStatus;
  createdAt: string;
  updatedAt?: string;
}

/**
 * 環状交換（3〜4人での持ち回り交換）のグループ。
 * 全員が承諾して初めて成立し、1人でも辞退すれば輪が閉じないので解散する。
 */
export class TradeGroup {
  constructor(private props: TradeGroupProps) {}

  get id(): string {
    return this.props.id;
  }
  get length(): number {
    return this.props.length;
  }
  get steps(): TradeStep[] {
    return [...this.props.steps];
  }
  get members(): string[] {
    return [...this.props.members];
  }
  get responses(): Record<string, GroupResponse> {
    return { ...this.props.responses };
  }
  get foundBy(): string | undefined {
    return this.props.foundBy;
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
  get status(): TradeGroupStatus {
    return this.props.status;
  }
  get createdAt(): string {
    return this.props.createdAt;
  }
  get updatedAt(): string | undefined {
    return this.props.updatedAt;
  }

  isMember(userId: string): boolean {
    return this.props.members.includes(userId);
  }

  isChattable(): boolean {
    return this.props.status === "ACCEPTED" || this.props.status === "COMPLETED";
  }

  acceptedCount(): number {
    return Object.values(this.props.responses).filter((r) => r === "accept").length;
  }

  /** 誰かの応答を記録する。全員が accept なら成立、1人でも decline なら即解散。 */
  respond(userId: string, answer: GroupResponse): void {
    if (!this.isMember(userId)) throw new ForbiddenError("このグループの参加者ではありません");
    if (this.props.status === "DECLINED") throw new ConflictError("このグループは解散済みです");

    this.props.responses = { ...this.props.responses, [userId]: answer };
    this.props.updatedAt = new Date().toISOString();

    if (answer === "decline") {
      this.props.status = "DECLINED";
      return;
    }
    const allAccepted = this.props.members.every((m) => this.props.responses[m] === "accept");
    if (allAccepted) this.props.status = "ACCEPTED";
  }

  complete(): void {
    if (this.props.status !== "ACCEPTED" && this.props.status !== "COMPLETED") {
      throw new ConflictError("成立したグループのみ完了にできます");
    }
    this.props.status = "COMPLETED";
    this.props.updatedAt = new Date().toISOString();
  }

  recordMessage(senderId: string, at: string, preview: string): void {
    this.props.lastMessageAt = at;
    this.props.lastMessageBy = senderId;
    this.props.lastMessagePreview = preview;
  }

  /** 自分から見た「渡す相手」のステップ。 */
  myGiveStep(userId: string): TradeStep | undefined {
    return this.props.steps.find((s) => s.fromUserId === userId);
  }

  /** 自分から見た「受け取る相手」のステップ。 */
  myReceiveStep(userId: string): TradeStep | undefined {
    return this.props.steps.find((s) => s.toUserId === userId);
  }

  toProps(): TradeGroupProps {
    return {
      ...this.props,
      steps: [...this.props.steps],
      members: [...this.props.members],
      responses: { ...this.props.responses },
    };
  }

  /** 参加カードの組で決まる ID。同じ輪を何度も作らない冪等キー。 */
  static idFor(giveCardIds: string[]): string {
    const joined = [...giveCardIds].sort().join("_");
    // 環境非依存の軽量ハッシュ（衝突許容度は十分：登録カードIDの組み合わせの識別用途）
    let hash = 0;
    for (let i = 0; i < joined.length; i++) {
      hash = (hash * 31 + joined.charCodeAt(i)) >>> 0;
    }
    return `grp_${hash.toString(16)}_${joined.length}`;
  }

  static create(steps: TradeStep[], foundBy?: string): TradeGroup {
    const members = steps.map((s) => s.fromUserId);
    const id = TradeGroup.idFor(steps.map((s) => s.giveCardId));
    return new TradeGroup({
      id,
      length: steps.length,
      steps,
      members,
      responses: {},
      foundBy,
      status: "NEW",
      createdAt: new Date().toISOString(),
    });
  }
}
