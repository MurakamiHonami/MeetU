import { client, unwrap } from "../../shared/api";
import type { Owner } from "../../entities/user/model";
import type { GeoPoint } from "../../entities/user/geo";

export const userApi = {
  me: async () => {
    const res = await client.api.me.$get();
    return unwrap<{ user: Owner & { cardCount: number } }>(res);
  },

  myReviews: async () => {
    const res = await client.api.me.reviews.$get();
    return unwrap<{ reviews: { rating: number; comment?: string; createdAt: string }[] }>(res);
  },

  updateFavorites: async (favorites: { name: string }[]) => {
    const res = await client.api.me.$put({ json: { favorites } });
    return unwrap<{ user: Owner }>(res);
  },

  updateHome: async (homeLocation: GeoPoint | null) => {
    const res = await client.api.me.$put({ json: { homeLocation } });
    return unwrap<{ user: Owner }>(res);
  },
};
