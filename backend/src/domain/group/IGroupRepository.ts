import { TradeGroup } from "./TradeGroup";

export interface IGroupRepository {
  findById(id: string): Promise<TradeGroup | null>;
  findByUserId(userId: string): Promise<TradeGroup[]>;
  /** 既に存在すれば false（＝同じ輪は提案済み）、新規作成できれば true。 */
  create(group: TradeGroup): Promise<boolean>;
  update(group: TradeGroup): Promise<void>;
  getLastReadAt(groupId: string, userId: string): Promise<string | null>;
  markRead(groupId: string, userId: string, at: string): Promise<void>;
  ensureMember(groupId: string, userId: string): Promise<void>;
}
