import { IMatchRepository } from '../domain/match/IMatchRepository';
import { IGroupRepository } from '../domain/group/IGroupRepository';
import { UploadPolicy } from '../domain/upload/UploadPolicy';
import { R2UploadService } from '../infrastructure/storage/R2UploadService';

export class UploadUseCase {
  constructor(
    private uploadService: R2UploadService,
    private matchRepo: IMatchRepository,
    private groupRepo: IGroupRepository
  ) {}

  async createUploadTicket(
    userId: string,
    input: { matchId?: string; groupId?: string; contentType: string; size?: number }
  ) {
    const contentType = UploadPolicy.validateContentType(input.contentType);
    UploadPolicy.validateSize(input.size);

    let threadId: string;
    if (input.matchId) {
      const match = await this.matchRepo.findById(input.matchId);
      if (!match) throw new Error('マッチが見つかりません');
      if (!match.isParty(userId)) throw new Error('このマッチの当事者ではありません');
      threadId = input.matchId;
    } else if (input.groupId) {
      const group = await this.groupRepo.findById(input.groupId);
      if (!group) throw new Error('グループが見つかりません');
      if (!group.isMember(userId)) throw new Error('このグループの参加者ではありません');
      threadId = input.groupId;
    } else {
      throw new Error('matchId か groupId を指定してください');
    }

    const key = UploadPolicy.imageKey(threadId, contentType);
    return this.uploadService.createUploadTicket(key, contentType);
  }
}
