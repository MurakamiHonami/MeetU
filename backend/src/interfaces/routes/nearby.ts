import { Hono } from "hono";
import { Env } from "../middleware/auth";
import { createContext } from "../container";
import { cardView } from "../dto/ViewMapper";
import { baseUrl, handleError } from "./helpers";
import { zValidator } from "../validation/validator";
import { nearbyQuerySchema } from "../validation/schemas";

export const nearbyRouter = new Hono<Env>().get(
  "/",
  zValidator("query", nearbyQuerySchema),
  async (c) => {
    try {
      const userId = c.get("userId");
      const query = c.req.valid("query");

      const ctx = createContext(c.env, baseUrl(c));
      const result = await ctx.useCases.nearby.search({
        userId,
        lat: query.lat,
        lon: query.lon,
        radiusKm: query.radius,
        type: query.type,
      });

      const cards = [];
      for (const row of result.cards) {
        const owner = await ctx.repos.userRepo.findById(row.card.ownerId);
        cards.push(
          cardView(row.card, owner ?? undefined, undefined, {
            distanceKm: row.distanceKm,
            distanceLabel: row.distanceLabel,
          }),
        );
      }
      return c.json({ cards, center: result.center, radiusKm: result.radiusKm });
    } catch (e) {
      return handleError(c, e);
    }
  },
);
