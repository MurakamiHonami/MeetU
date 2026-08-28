import { count, eq } from 'drizzle-orm';
import { IReportRepository } from '../../../domain/report/IReportRepository';
import { Report } from '../../../domain/report/Report';
import { AppDatabase } from '../database';
import { reports } from '../schema';

export class D1ReportRepository implements IReportRepository {
  constructor(private db: AppDatabase) {}

  async save(report: Report): Promise<void> {
    const p = report.toProps();
    await this.db.insert(reports).values({
      id: p.id,
      reporterId: p.reporterId,
      targetUserId: p.targetUserId,
      matchId: p.matchId ?? null,
      reason: p.reason,
      detail: p.detail ?? null,
      status: p.status,
      createdAt: p.createdAt,
    });
  }

  async countByTarget(targetUserId: string): Promise<number> {
    const row = await this.db
      .select({ cnt: count() })
      .from(reports)
      .where(eq(reports.targetUserId, targetUserId))
      .get();
    return row?.cnt ?? 0;
  }
}
