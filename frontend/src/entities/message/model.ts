import type { GeoPoint } from "../user/geo";

export type Message = {
  messageId: string;
  text: string;
  createdAt: string;
  mine: boolean;
  kind: "text" | "image" | "location";
  imageUrl?: string;
  location?: GeoPoint;
};
