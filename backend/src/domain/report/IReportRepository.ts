import { Report } from "./Report";

export interface IReportRepository {
  save(report: Report): Promise<void>;
  existsByReporterAndMatch(reporterId: string, matchId: string): Promise<boolean>;
}
