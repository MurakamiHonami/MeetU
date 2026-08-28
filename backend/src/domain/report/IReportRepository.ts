import { Report } from './Report';

export interface IReportRepository {
  save(report: Report): Promise<void>;
  countByTarget(targetUserId: string): Promise<number>;
}
