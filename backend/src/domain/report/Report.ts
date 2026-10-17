import { ValidationError } from "../shared/DomainError";

export type ReportReason =
  | "NOT_DELIVERED"
  | "ITEM_CONDITION"
  | "HARASSMENT"
  | "FRAUD"
  | "NO_SHOW"
  | "OTHER";

export const REPORT_REASONS: Record<ReportReason, string> = {
  NOT_DELIVERED: "商品が届かない",
  ITEM_CONDITION: "商品の状態が説明と違う",
  HARASSMENT: "迷惑行為・暴言",
  FRAUD: "詐欺の疑い",
  NO_SHOW: "当日来なかった",
  OTHER: "その他",
};

export type ReportStatus = "PENDING" | "RESOLVED";

export interface ReportProps {
  id: string;
  reporterId: string;
  targetUserId: string;
  matchId: string;
  reason: ReportReason;
  detail?: string;
  status: ReportStatus;
  createdAt: string;
}

const MAX_DETAIL = 500;

export class Report {
  constructor(private props: ReportProps) {}

  get id(): string {
    return this.props.id;
  }
  get reporterId(): string {
    return this.props.reporterId;
  }
  get targetUserId(): string {
    return this.props.targetUserId;
  }
  get matchId(): string {
    return this.props.matchId;
  }
  get reason(): ReportReason {
    return this.props.reason;
  }
  get reasonLabel(): string {
    return REPORT_REASONS[this.props.reason];
  }
  get detail(): string | undefined {
    return this.props.detail;
  }
  get status(): ReportStatus {
    return this.props.status;
  }
  get createdAt(): string {
    return this.props.createdAt;
  }

  toProps(): ReportProps {
    return { ...this.props };
  }

  static create(input: {
    reporterId: string;
    targetUserId: string;
    matchId: string;
    reason: ReportReason;
    detail?: string;
  }): Report {
    if (input.reporterId === input.targetUserId) {
      throw new ValidationError("自分自身は通報できません");
    }
    if (!(input.reason in REPORT_REASONS)) {
      throw new ValidationError(
        `reason は ${Object.keys(REPORT_REASONS).join("/")} のいずれかです`,
      );
    }
    return new Report({
      id: crypto.randomUUID(),
      reporterId: input.reporterId,
      targetUserId: input.targetUserId,
      matchId: input.matchId,
      reason: input.reason,
      detail: input.detail?.trim().slice(0, MAX_DETAIL) || undefined,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    });
  }
}
