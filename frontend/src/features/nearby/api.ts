import { client, unwrap } from "../../shared/api";
import type { Card, CardType } from "../../entities/card/model";

export const nearbyApi = {
  nearby: async (params: { lat: number; lon: number; radius: number; type?: CardType | "" }) => {
    const res = await client.api.nearby.$get({
      query: {
        lat: String(params.lat),
        lon: String(params.lon),
        radius: String(params.radius),
        ...(params.type ? { type: params.type } : {}),
      },
    });
    return unwrap<{
      cards: Card[];
      center: { lat: number; lon: number };
      radiusKm: number;
    }>(res);
  },
};
