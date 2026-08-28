import { Hono } from "hono";
import { Env } from "../middleware/auth";
import { createContext } from "../container";
import { ownerView } from "../dto/ViewMapper";
import { baseUrl, handleError } from "./helpers";
import { Location } from "../../domain/shared/Location";
import { parseJson, readJsonBody } from "../validation/parseRequest";
import { updateMeSchema } from "../validation/schemas";

export const meRouter = new Hono<Env>()
  .get("/", async (c) => {
    try {
      const userId = c.get("userId");
      const ctx = createContext(c.env, baseUrl(c));
      const profile = await ctx.useCases.user.getProfile(userId);
      if (!profile) return c.json({ message: "ユーザーが見つかりません" }, 404);
      return c.json({
        user: { ...ownerView(profile.user), cardCount: profile.cardCount },
      });
    } catch (e) {
      return handleError(c, e);
    }
  })

  .get("/reviews", async (c) => {
    try {
      const userId = c.get("userId");
      const ctx = createContext(c.env, baseUrl(c));
      const reviews = await ctx.useCases.user.getMyReviews(userId);
      return c.json({ reviews });
    } catch (e) {
      return handleError(c, e);
    }
  })

  .put("/", async (c) => {
    try {
      const userId = c.get("userId");
      const raw = await readJsonBody(c);
      if (!raw.ok) return raw.response;
      const parsed = parseJson(c, updateMeSchema, raw.data);
      if (!parsed.ok) return parsed.response;
      const ctx = createContext(c.env, baseUrl(c));

      let user;
      if ("favorites" in parsed.data) {
        user = await ctx.useCases.user.updateFavorites(userId, parsed.data.favorites);
      } else if ("homeLocation" in parsed.data) {
        const loc = parsed.data.homeLocation
          ? (Location.tryParse(parsed.data.homeLocation)?.toJSON() ?? null)
          : null;
        user = await ctx.useCases.user.updateHome(userId, loc);
      } else {
        user = await ctx.useCases.user.updateProfile(
          userId,
          parsed.data.displayName,
          parsed.data.pictureUrl,
        );
      }

      if (!user) return c.json({ message: "ユーザーが見つかりません" }, 404);
      return c.json({ user: ownerView(user) });
    } catch (e) {
      return handleError(c, e);
    }
  });
