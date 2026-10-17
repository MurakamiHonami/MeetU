import { Match } from "./Match";

export interface IMatchRepository {
  findById(id: string): Promise<Match | null>;
  findByUserId(userId: string): Promise<Match[]>;
  save(match: Match): Promise<void>;
  updateStatus(id: string, status: Match["status"]): Promise<void>;
  getLastReadAt(matchId: string, userId: string): Promise<string | null>;
  getLastReadAtBatch(matchIds: string[], userId: string): Promise<Map<string, string | null>>;
  markRead(matchId: string, userId: string, at: string): Promise<void>;
}
