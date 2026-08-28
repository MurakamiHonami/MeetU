import type { Card } from "../card/model";
import type { Owner } from "../user/model";

export type Match = {
  matchId: string;
  status: string;
  statusLabel: string;
  matchCount: number;
  matchedTags: string[];
  createdAt: string;
  acceptedByMe: boolean;
  acceptedByPartner: boolean;
  distanceLabel?: string;
  canChat: boolean;
  hasUnread: boolean;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  partner: Owner | null;
  partnerCard: Card | null;
  myCard: Card | null;
  iGive: Card | null;
  iReceive: Card | null;
};
