import { Hono } from "hono";
import { Env } from "../middleware/auth";
import { createContext } from "../container";
import { cardView } from "../dto/ViewMapper";
import { baseUrl, handleError } from "./helpers";
import { parseQueryParams } from "../validation/parseRequest";
import { nearbyQuerySchema } from "../validation/schemas";

export const nearbyRouter = new Hono<Env>().get("/", async (c) => {
  try {
    const userId = c.get("userId");
    const query = parseQueryParams(c, nearbyQuerySchema);
    if (!query.ok) return query.response;

    const ctx = createContext(c.env, baseUrl(c));
    const result = await ctx.useCases.nearby.search({
      userId,
      lat: query.data.lat,
      lon: query.data.lon,
      radiusKm: query.data.radius,
      type: query.data.type,
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
});
