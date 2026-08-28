import ngeohash from "ngeohash";
import { ValidationError } from "./DomainError";

const EARTH_RADIUS_KM = 6371.0;

export const DEFAULT_GEOHASH_PRECISION = 5;
export const MAX_RADIUS_KM = 50.0;

export interface LocationProps {
  lat: number;
  lon: number;
  name?: string;
}

/**
 * 位置情報の Value Object。geohash による近傍検索と距離計算を担う。
 * 外部ライブラリは使わない。
 */
export class Location {
  constructor(private props: LocationProps) {
    if (!Number.isFinite(props.lat) || !Number.isFinite(props.lon)) {
      throw new ValidationError("緯度経度が数値ではありません");
    }
    if (props.lat < -90 || props.lat > 90 || props.lon < -180 || props.lon > 180) {
      throw new ValidationError("緯度経度の範囲が不正です");
    }
  }

  get lat(): number {
    return this.props.lat;
  }
  get lon(): number {
    return this.props.lon;
  }
  get name(): string | undefined {
    return this.props.name;
  }

  geohash(precision = 6): string {
    return Location.encode(this.props.lat, this.props.lon, precision);
  }

  distanceKm(other: Location): number {
    return Location.distanceKm(this.props.lat, this.props.lon, other.lat, other.lon);
  }

  distanceLabel(other: Location): string {
    return Location.formatDistance(this.distanceKm(other));
  }

  toJSON(): LocationProps {
    return {
      lat: this.props.lat,
      lon: this.props.lon,
      ...(this.props.name ? { name: this.props.name } : {}),
    };
  }

  static encode(lat: number, lon: number, precision = DEFAULT_GEOHASH_PRECISION): string {
    return ngeohash.encode(lat, lon, precision);
  }

  /** 検索半径に見合う桁数。広いほど粗いセルを使う。 */
  static precisionFor(radiusKm: number): number {
    if (radiusKm <= 1.5) return 6;
    if (radiusKm <= 8) return 5;
    return 4;
  }

  /** 中心セルと周囲8セルの geohash。セル境界に近い相手を取りこぼさないため。 */
  static cellsAround(lat: number, lon: number, precision = DEFAULT_GEOHASH_PRECISION): string[] {
    const center = ngeohash.encode(lat, lon, precision);
    const neighbors: string[] = ngeohash.neighbors(center);
    return Array.from(new Set([center, ...neighbors])).sort();
  }

  /** 2点間の距離（ハバサイン公式）。 */
  static distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const phi1 = toRad(lat1);
    const phi2 = toRad(lat2);
    const dPhi = toRad(lat2 - lat1);
    const dLambda = toRad(lon2 - lon1);

    const a =
      Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
  }

  /** 表示用。1km未満はmにする。 */
  static formatDistance(km: number): string {
    if (km < 1) return `${Math.round((km * 1000) / 50) * 50}m`;
    if (km < 10) return `${km.toFixed(1)}km`;
    return `${Math.round(km)}km`;
  }

  static tryParse(raw: unknown): Location | null {
    if (!raw || typeof raw !== "object") return null;
    const obj = raw as Record<string, unknown>;
    if (obj.lat === undefined || obj.lon === undefined) return null;
    const lat = Number(obj.lat);
    const lon = Number(obj.lon);
    const name = typeof obj.name === "string" ? obj.name.trim().slice(0, 60) : undefined;
    return new Location({ lat, lon, ...(name ? { name } : {}) });
  }
}
