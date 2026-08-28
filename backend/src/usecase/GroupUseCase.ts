import { IGroupRepository } from "../domain/group/IGroupRepository";
import { ICardRepository } from "../domain/card/ICardRepository";
import { IUserRepository } from "../domain/user/IUserRepository";
import { TradeGroup } from "../domain/group/TradeGroup";
import { User } from "../domain/user/User";
import { Card } from "../domain/card/Card";

export interface GroupDetail {
  group: TradeGroup;
  users: Map<string, User>;
  cards: Map<string, Card>;
  lastReadAt: string | null;
}

export class GroupUseCase {
  constructor(
    private groupRepo: IGroupRepository,
    private cardRepo: ICardRepository,
    private userRepo: IUserRepository,
  ) {}

  async getMyGroups(userId: string): Promise<TradeGroup[]> {
    return this.groupRepo.findByUserId(userId);
  }

  async getGroupDetail(groupId: string, userId: string): Promise<GroupDetail | null> {
    const group = await this.groupRepo.findById(groupId);
    if (!group || !group.isMember(userId)) return null;

    const users = new Map<string, User>();
    const cards = new Map<string, Card>();

    for (const memberId of group.members) {
      const u = await this.userRepo.findById(memberId);
      if (u) users.set(memberId, u);
    }
    for (const step of group.steps) {
      if (!cards.has(step.giveCardId)) {
        const c = await this.cardRepo.findById(step.giveCardId);
        if (c) cards.set(step.giveCardId, c);
      }
    }

    const lastReadAt = await this.groupRepo.getLastReadAt(groupId, userId);
    return { group, users, cards, lastReadAt };
  }

  async accept(
    groupId: string,
    userId: string,
  ): Promise<{ group: TradeGroup; established: boolean } | null> {
    const group = await this.groupRepo.findById(groupId);
    if (!group || !group.isMember(userId)) return null;
    group.respond(userId, "accept");
    await this.groupRepo.update(group);
    return { group, established: group.status === "ACCEPTED" };
  }

  async decline(groupId: string, userId: string): Promise<TradeGroup | null> {
    const group = await this.groupRepo.findById(groupId);
    if (!group || !group.isMember(userId)) return null;
    group.respond(userId, "decline");
    await this.groupRepo.update(group);
    return group;
  }

  async complete(groupId: string, userId: string): Promise<TradeGroup | null> {
    const group = await this.groupRepo.findById(groupId);
    if (!group || !group.isMember(userId)) return null;
    group.complete();
    await this.groupRepo.update(group);
    return group;
  }

  async loadGroupContext(groups: TradeGroup[], userId: string) {
    const users = new Map<string, User>();
    const cards = new Map<string, Card>();
    const readAts = new Map<string, string | null>();

    for (const group of groups) {
      readAts.set(group.id, await this.groupRepo.getLastReadAt(group.id, userId));
      for (const memberId of group.members) {
        if (!users.has(memberId)) {
          const u = await this.userRepo.findById(memberId);
          if (u) users.set(memberId, u);
        }
      }
      for (const step of group.steps) {
        if (!cards.has(step.giveCardId)) {
          const c = await this.cardRepo.findById(step.giveCardId);
          if (c) cards.set(step.giveCardId, c);
        }
      }
    }
    return { users, cards, readAts };
  }
}
