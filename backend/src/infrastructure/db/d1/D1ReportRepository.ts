import { and, eq } from "drizzle-orm";
import { IReportRepository } from "../../../domain/report/IReportRepository";
import { Report } from "../../../domain/report/Report";
import { AppDatabase } from "../database";
import { reports } from "../schema";

export class D1ReportRepository implements IReportRepository {
  constructor(private db: AppDatabase) {}

  async save(report: Report): Promise<void> {
    const p = report.toProps();
    await this.db.insert(reports).values({
      id: p.id,
      reporterId: p.reporterId,
      targetUserId: p.targetUserId,
      matchId: p.matchId,
      reason: p.reason,
      detail: p.detail ?? null,
      status: p.status,
      createdAt: p.createdAt,
    });
  }

  async existsByReporterAndMatch(reporterId: string, matchId: string): Promise<boolean> {
    const row = await this.db
      .select({ id: reports.id })
      .from(reports)
      .where(and(eq(reports.reporterId, reporterId), eq(reports.matchId, matchId)))
      .get();
    return !!row;
  }
}
