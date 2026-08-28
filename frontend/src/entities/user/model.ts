import type { Tag } from "../tag/model";
import type { GeoPoint } from "../user/geo";

export type Owner = {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  ratingAvg: number | null;
  ratingCount: number;
  tradeCount: number;
  isNew: boolean;
  favorites?: Tag[];
  homeLocation?: GeoPoint | null;
};

export type { GeoPoint } from "./geo";
