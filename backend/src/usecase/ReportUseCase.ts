import { IReportRepository } from "../domain/report/IReportRepository";
import { IUserRepository } from "../domain/user/IUserRepository";
import { IMatchRepository } from "../domain/match/IMatchRepository";
import { Report, ReportReason } from "../domain/report/Report";
import { NotFoundError, ForbiddenError, ConflictError } from "../domain/shared/DomainError";

export class ReportUseCase {
  constructor(
    private reportRepo: IReportRepository,
    private userRepo: IUserRepository,
    private matchRepo: IMatchRepository,
  ) {}

  async createReport(input: {
    reporterId: string;
    targetUserId: string;
    matchId: string;
    reason: ReportReason;
    detail?: string;
  }) {
    const match = await this.matchRepo.findById(input.matchId);
    if (!match) throw new NotFoundError("マッチが見つかりません");
    if (!match.isParty(input.reporterId))
      throw new ForbiddenError("このマッチの当事者ではありません");
    if (match.partnerOf(input.reporterId) !== input.targetUserId)
      throw new ForbiddenError("このマッチの相手以外は通報できません");

    const alreadyReported = await this.reportRepo.existsByReporterAndMatch(
      input.reporterId,
      input.matchId,
    );
    if (alreadyReported) throw new ConflictError("このマッチは既に通報済みです");

    const report = Report.create(input);
    await this.reportRepo.save(report);

    const target = await this.userRepo.findById(input.targetUserId);
    if (target) {
      target.incrementReport();
      await this.userRepo.update(target);
    }

    return report;
  }
}
