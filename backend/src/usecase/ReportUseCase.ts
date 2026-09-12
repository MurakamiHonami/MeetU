import { IReportRepository } from "../domain/report/IReportRepository";
import { IUserRepository } from "../domain/user/IUserRepository";
import { Report, ReportReason } from "../domain/report/Report";
import { AuthService } from "../infrastructure/auth/AuthService";

export class ReportUseCase {
  constructor(
    private reportRepo: IReportRepository,
    private userRepo: IUserRepository,
    private authService: AuthService,
  ) {}

  async createReport(input: {
    reporterId: string;
    targetUserId: string;
    matchId?: string;
    reason: ReportReason;
    detail?: string;
  }) {
    const report = Report.create(input);
    await this.reportRepo.save(report);

    const target = await this.userRepo.findById(input.targetUserId);
    if (target) {
      const wasSuspended = target.isSuspended();
      target.incrementReport();
      await this.userRepo.update(target);
      if (!wasSuspended && target.isSuspended()) {
        await this.authService.revokeAllRefreshTokensForUser(target.id);
      }
    }

    return report;
  }
}
