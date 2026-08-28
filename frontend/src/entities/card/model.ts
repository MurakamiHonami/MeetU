import type { Tag } from "../tag/model";
import type { GeoPoint, Owner } from "../user/model";

export type CardType = "GIVE" | "WANT" | "COMPANION";

export const TYPE_LABEL: Record<CardType, string> = {
  GIVE: "【譲】",
  WANT: "【求】",
  COMPANION: "【同行者求】",
};

export type Card = {
  cardId: string;
  type: CardType;
  title: string;
  note?: string;
  tags: Tag[];
  requiredTags: string[];
  minMatchCount: number;
  dates?: string[];
  location?: GeoPoint;
  status: string;
  createdAt: string;
  owner?: Owner;
  matchedTags?: string[];
  matchCount?: number;
  score?: number;
  reasonTags?: string[];
  distanceKm?: number;
  distanceLabel?: string;
};
