import { client, unwrap } from "../../shared/api";
import type { Card, CardType } from "../../entities/card/model";
import type { Group } from "../../entities/group/model";
import type { GeoPoint } from "../../entities/user/geo";

export const cardApi = {
  createCard: async (payload: {
    type: CardType;
    title: string;
    note?: string;
    tags: { name: string; category?: string }[];
    requiredTags?: { name: string }[];
    minMatchCount: number;
    dates?: string[];
    location?: GeoPoint | null;
  }) => {
    const res = await client.api.cards.$post({
      json: {
        ...payload,
        tags: payload.tags.map((t) => ({ displayName: t.name, category: t.category })),
        requiredTags: payload.requiredTags?.map((t) => t.name),
      },
    });
    return unwrap<{
      card: Card;
      newMatches: { matchId: string; matchCount: number; matchedTags: string[]; card: Card }[];
      newGroups: Group[];
    }>(res);
  },

  myCards: async () => {
    const res = await client.api.cards.mine.$get();
    return unwrap<{ cards: Card[] }>(res);
  },

  card: async (cardId: string) => {
    const res = await client.api.cards[":id"].$get({ param: { id: cardId } });
    return unwrap<{ card: Card }>(res);
  },

  closeCard: async (cardId: string) => {
    const res = await client.api.cards[":id"].$delete({ param: { id: cardId } });
    return unwrap<{ card: Card }>(res);
  },

  cardMatches: async (cardId: string) => {
    const res = await client.api.cards[":id"].matches.$get({ param: { id: cardId } });
    return unwrap<{ cards: Card[]; minMatchCount: number }>(res);
  },

  search: async (params: { tags: string[]; type?: CardType | ""; minMatch: number }) => {
    const res = await client.api.cards.$get({
      query: {
        tags: params.tags.join(","),
        minMatch: String(params.minMatch),
        ...(params.type ? { type: params.type } : {}),
      },
    });
    return unwrap<{ cards: Card[] }>(res);
  },
};
