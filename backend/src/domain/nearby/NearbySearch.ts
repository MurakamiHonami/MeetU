import { Card, CardType } from "../card/Card";
import { Location, MAX_RADIUS_KM } from "../shared/Location";

export const DEFAULT_RADIUS_KM = 3.0;
export const MAX_RESULTS = 60;

export interface NearbyResult {
  card: Card;
  distanceKm: number;
  distanceLabel: string;
}

export interface NearbySearchInput {
  lat: number;
  lon: number;
  radiusKm?: number;
  type?: CardType;
  excludeOwnerId?: string;
}

/**
 * geohash セルで候補を絞り、実距離で最終フィルタする。
 */
export class NearbySearch {
  static parseRadius(raw: unknown): number {
    if (raw === undefined || raw === null || raw === "") return DEFAULT_RADIUS_KM;
    const km = Number(raw);
    if (!Number.isFinite(km) || km <= 0) {
      throw new Error("radius は 0 より大きい数値で指定してください");
    }
    return Math.min(km, MAX_RADIUS_KM);
  }

  static filter(cards: Card[], input: NearbySearchInput): NearbyResult[] {
    const radius = input.radiusKm ?? DEFAULT_RADIUS_KM;
    const center = new Location({ lat: input.lat, lon: input.lon });
    const results: NearbyResult[] = [];

    for (const card of cards) {
      if (!card.isOpen()) continue;
      if (input.excludeOwnerId && card.ownerId === input.excludeOwnerId) continue;
      if (input.type && card.type !== input.type) continue;
      const loc = card.location;
      if (!loc) continue;

      const distanceKm = center.distanceKm(loc);
      if (distanceKm > radius) continue;

      results.push({
        card,
        distanceKm,
        distanceLabel: center.distanceLabel(loc),
      });
    }

    results.sort((a, b) => a.distanceKm - b.distanceKm);
    return results.slice(0, MAX_RESULTS);
  }

  static cellsFor(lat: number, lon: number, radiusKm: number): string[] {
    const precision = Location.precisionFor(radiusKm);
    return Location.cellsAround(lat, lon, precision);
  }
}
