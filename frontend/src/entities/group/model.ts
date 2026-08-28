import type { Card } from "../card/model";
import type { Owner } from "../user/model";

export type GroupStep = {
  from: Owner;
  to: Owner;
  card: Card | null;
  matchedTags: string[];
  isMine: boolean;
};

export type Group = {
  groupId: string;
  length: number;
  status: string;
  statusLabel: string;
  createdAt: string;
  steps: GroupStep[];
  members: Owner[];
  myAnswer?: "accept" | "decline";
  acceptedCount: number;
  iGive: Card | null;
  iGiveTo: Owner | null;
  iReceive: Card | null;
  iReceiveFrom: Owner | null;
  canChat: boolean;
  lastMessagePreview?: string;
  hasUnread: boolean;
};
