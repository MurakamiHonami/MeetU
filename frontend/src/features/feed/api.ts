import { client, unwrap } from "../../shared/api";
import type { Card } from "../../entities/card/model";

export const feedApi = {
  feed: async () => {
    const res = await client.api.feed.$get();
    return unwrap<{ cards: Card[]; hasFavorites: boolean }>(res);
  },

  saveCard: async (cardId: string) => {
    const res = await client.api.feed[":cardId"].save.$post({ param: { cardId } });
    return unwrap<{ cardId: string }>(res);
  },

  skipCard: async (cardId: string) => {
    const res = await client.api.feed[":cardId"].skip.$post({ param: { cardId } });
    return unwrap<{ cardId: string }>(res);
  },

  savedCards: async () => {
    const res = await client.api.saved.$get();
    return unwrap<{ cards: Card[] }>(res);
  },

  unsaveCard: async (cardId: string) => {
    const res = await client.api.saved[":cardId"].$delete({ param: { cardId } });
    return unwrap<{ cardId: string }>(res);
  },
};
