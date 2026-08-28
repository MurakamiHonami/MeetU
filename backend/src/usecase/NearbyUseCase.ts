import { ICardRepository } from "../domain/card/ICardRepository";
import { IUserRepository } from "../domain/user/IUserRepository";
import { NearbySearch, DEFAULT_RADIUS_KM } from "../domain/nearby/NearbySearch";
import { CardType } from "../domain/card/Card";
import { Location } from "../domain/shared/Location";

export class NearbyUseCase {
  constructor(
    private cardRepo: ICardRepository,
    private userRepo: IUserRepository,
  ) {}

  async search(input: {
    userId: string;
    lat: number;
    lon: number;
    radiusKm?: number;
    type?: CardType;
  }) {
    const user = await this.userRepo.findById(input.userId);
    if (!user) throw new Error("ユーザーが見つかりません");

    Location.tryParse({ lat: input.lat, lon: input.lon });
    const radiusKm = input.radiusKm ?? DEFAULT_RADIUS_KM;
    const cells = NearbySearch.cellsFor(input.lat, input.lon, radiusKm);
    const candidates = await this.cardRepo.findByGeohashCells(cells);

    const results = NearbySearch.filter(candidates, {
      lat: input.lat,
      lon: input.lon,
      radiusKm,
      type: input.type,
      excludeOwnerId: input.userId,
    });

    return {
      cards: results,
      center: { lat: input.lat, lon: input.lon },
      radiusKm,
    };
  }
}
