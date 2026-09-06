import { IMessageRepository } from "../domain/message/IMessageRepository";
import { IMatchRepository } from "../domain/match/IMatchRepository";
import { IGroupRepository } from "../domain/group/IGroupRepository";
import { IUserRepository } from "../domain/user/IUserRepository";
import { Message } from "../domain/message/Message";
import { Location, LocationProps } from "../domain/shared/Location";
import { UploadPolicy } from "../domain/upload/UploadPolicy";
import { R2UploadService } from "../infrastructure/storage/R2UploadService";
import { User } from "../domain/user/User";
import { NotFoundError, ForbiddenError, ConflictError } from "../domain/shared/DomainError";

const CHATTABLE = new Set(["ACCEPTED", "COMPLETED"]);

export class MessageUseCase {
  constructor(
    private messageRepo: IMessageRepository,
    private matchRepo: IMatchRepository,
    private groupRepo: IGroupRepository,
    private userRepo: IUserRepository,
    private uploadService: R2UploadService,
  ) {}

  private async assertNotSuspended(userId: string): Promise<User> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError("ユーザーが見つかりません");
    if (user.isSuspended()) throw new ForbiddenError("通報が重なったため現在ご利用いただけません");
    return user;
  }

  async listMatchMessages(matchId: string, userId: string, after?: string) {
    const match = await this.matchRepo.findById(matchId);
    if (!match) throw new NotFoundError("マッチが見つかりません");
    if (!match.isParty(userId)) throw new ForbiddenError("このマッチの当事者ではありません");

    const messages = await this.messageRepo.findByThread("MATCH", matchId, after);
    const now = new Date().toISOString();
    await this.matchRepo.markRead(matchId, userId, now);

    const partnerId = match.partnerOf(userId);
    const partner = await this.userRepo.findById(partnerId);

    return {
      messages,
      canSend: CHATTABLE.has(match.status),
      status: match.status,
      partner,
    };
  }

  async sendMatchMessage(
    matchId: string,
    userId: string,
    input: { text?: string; imageKey?: string; location?: LocationProps },
  ) {
    await this.assertNotSuspended(userId);
    const match = await this.matchRepo.findById(matchId);
    if (!match) throw new NotFoundError("マッチが見つかりません");
    if (!match.isParty(userId)) throw new ForbiddenError("このマッチの当事者ではありません");
    if (!CHATTABLE.has(match.status))
      throw new ConflictError("双方が承諾するとトークを始められます");

    if (input.imageKey) UploadPolicy.assertKeyBelongsToThread(input.imageKey, matchId);

    const message = Message.create({
      threadType: "MATCH",
      threadId: matchId,
      senderId: userId,
      text: input.text,
      imageKey: input.imageKey,
      location: input.location ? new Location(input.location).toJSON() : undefined,
    });

    await this.messageRepo.save(message);
    match.recordMessage(userId, message.createdAt, message.preview());
    await this.matchRepo.save(match);
    await this.matchRepo.markRead(matchId, userId, message.createdAt);

    return { message, notified: false };
  }

  async listGroupMessages(groupId: string, userId: string, after?: string) {
    const group = await this.groupRepo.findById(groupId);
    if (!group) throw new NotFoundError("グループが見つかりません");
    if (!group.isMember(userId)) throw new ForbiddenError("このグループの参加者ではありません");

    const messages = await this.messageRepo.findByThread("GROUP", groupId, after);
    const now = new Date().toISOString();
    await this.groupRepo.markRead(groupId, userId, now);

    const members = await this.userRepo.findByIds(group.members);

    return {
      messages,
      canSend: group.isChattable(),
      status: group.status,
      members,
    };
  }

  async sendGroupMessage(
    groupId: string,
    userId: string,
    input: { text?: string; imageKey?: string; location?: LocationProps },
  ) {
    await this.assertNotSuspended(userId);
    const group = await this.groupRepo.findById(groupId);
    if (!group) throw new NotFoundError("グループが見つかりません");
    if (!group.isMember(userId)) throw new ForbiddenError("このグループの参加者ではありません");
    if (!group.isChattable()) throw new ConflictError("成立したグループでのみトークできます");

    if (input.imageKey) UploadPolicy.assertKeyBelongsToThread(input.imageKey, groupId);

    const message = Message.create({
      threadType: "GROUP",
      threadId: groupId,
      senderId: userId,
      text: input.text,
      imageKey: input.imageKey,
      location: input.location ? new Location(input.location).toJSON() : undefined,
    });

    await this.messageRepo.save(message);
    group.recordMessage(userId, message.createdAt, message.preview());
    await this.groupRepo.update(group);
    await this.groupRepo.markRead(groupId, userId, message.createdAt);

    return { message };
  }

  getImageUrl(key: string) {
    return this.uploadService.createViewUrl(key);
  }
}
