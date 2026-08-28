import { IReportRepository } from '../domain/report/IReportRepository';
import { IUserRepository } from '../domain/user/IUserRepository';
import { Report, ReportReason } from '../domain/report/Report';

export class ReportUseCase {
  constructor(
    private reportRepo: IReportRepository,
    private userRepo: IUserRepository
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
      target.incrementReport();
      await this.userRepo.update(target);
    }

    return report;
  }
}
