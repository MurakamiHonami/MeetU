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
    return this.buildGroupDetail(group, userId);
  }

  async buildGroupDetail(group: TradeGroup, userId: string): Promise<GroupDetail> {
    const users = new Map<string, User>();
    const cards = new Map<string, Card>();

    for (const u of await this.userRepo.findByIds(group.members)) {
      users.set(u.id, u);
    }
    const cardIds = [...new Set(group.steps.map((step) => step.giveCardId))];
    for (const c of await this.cardRepo.findByIds(cardIds)) {
      cards.set(c.id, c);
    }

    const lastReadAt = await this.groupRepo.getLastReadAt(group.id, userId);
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

    const memberIds = new Set<string>();
    const cardIds = new Set<string>();
    for (const group of groups) {
      for (const memberId of group.members) memberIds.add(memberId);
      for (const step of group.steps) cardIds.add(step.giveCardId);
    }
    for (const u of await this.userRepo.findByIds([...memberIds])) {
      users.set(u.id, u);
    }
    for (const c of await this.cardRepo.findByIds([...cardIds])) {
      cards.set(c.id, c);
    }

    for (const group of groups) {
      readAts.set(group.id, await this.groupRepo.getLastReadAt(group.id, userId));
    }
    return { users, cards, readAts };
  }
}
