import { Hono } from "hono";
import { Env } from "../middleware/auth";
import { createContext } from "../container";
import { cardView, groupView } from "../dto/ViewMapper";
import { baseUrl, handleError } from "./helpers";
import { parseJson, parseQueryParams, readJsonBody } from "../validation/parseRequest";
import { cardsSearchQuerySchema, createCardSchema } from "../validation/schemas";

export const cardsRouter = new Hono<Env>()
  .get("/", async (c) => {
    try {
      const query = parseQueryParams(c, cardsSearchQuerySchema);
      if (!query.ok) return query.response;
      const ctx = createContext(c.env, baseUrl(c));
      const tags = query.data.tags.split(",").filter(Boolean);
      const cards = await ctx.useCases.card.searchCards(tags, query.data.minMatch, query.data.type);

      const views = [];
      for (const card of cards) {
        const owner = await ctx.repos.userRepo.findById(card.ownerId);
        views.push(cardView(card, owner ?? undefined));
      }
      return c.json({ cards: views });
    } catch (e) {
      return handleError(c, e);
    }
  })

  .post("/", async (c) => {
    try {
      const userId = c.get("userId");
      const raw = await readJsonBody(c);
      if (!raw.ok) return raw.response;
      const parsed = parseJson(c, createCardSchema, raw.data);
      if (!parsed.ok) return parsed.response;
      const ctx = createContext(c.env, baseUrl(c));

      const tags = parsed.data.tags.map((t) => ({
        displayName: t.name || t.displayName || "",
        category: t.category,
      }));
      const requiredTags = (parsed.data.requiredTags || []).map((t) =>
        typeof t === "string" ? t : t.name,
      );

      const result = await ctx.useCases.card.createCard({
        ownerId: userId,
        type: parsed.data.type,
        title: parsed.data.title,
        note: parsed.data.note,
        minMatchCount: parsed.data.minMatchCount,
        tags,
        requiredTags,
        dates: parsed.data.dates,
        location: parsed.data.location ?? undefined,
      });

      const owner = await ctx.repos.userRepo.findById(userId);
      const groupViews = [];
      for (const g of result.newGroups) {
        const detail = await ctx.useCases.group.getGroupDetail(g.id, userId);
        if (detail) {
          groupViews.push(
            groupView(detail.group, userId, detail.users, detail.cards, detail.lastReadAt),
          );
        }
      }

      return c.json(
        {
          card: cardView(result.card, owner ?? undefined),
          newMatches: result.newMatches.map((m) => ({
            matchId: m.matchId,
            matchCount: m.matchCount,
            matchedTags: m.matchedTags,
            card: cardView(m.card),
          })),
          newGroups: groupViews,
        },
        201,
      );
    } catch (e) {
      return handleError(c, e);
    }
  })

  .get("/mine", async (c) => {
    try {
      const userId = c.get("userId");
      const ctx = createContext(c.env, baseUrl(c));
      const cards = await ctx.useCases.card.getMyCards(userId);
      return c.json({ cards: cards.map((card) => cardView(card)) });
    } catch (e) {
      return handleError(c, e);
    }
  })

  .get("/:id/matches", async (c) => {
    try {
      const userId = c.get("userId");
      const id = c.req.param("id");
      const ctx = createContext(c.env, baseUrl(c));
      const result = await ctx.useCases.card.getCardMatches(id, userId);
      if (!result) return c.json({ message: "カードが見つかりません" }, 404);
      const views = [];
      for (const card of result.cards) {
        const owner = await ctx.repos.userRepo.findById(card.ownerId);
        views.push(cardView(card, owner ?? undefined));
      }
      return c.json({ cards: views, minMatchCount: result.minMatchCount });
    } catch (e) {
      return handleError(c, e);
    }
  })

  .get("/:id", async (c) => {
    try {
      const id = c.req.param("id");
      const ctx = createContext(c.env, baseUrl(c));
      const card = await ctx.useCases.card.getCard(id);
      if (!card) return c.json({ message: "カードが見つかりません" }, 404);
      const owner = await ctx.repos.userRepo.findById(card.ownerId);
      return c.json({ card: cardView(card, owner ?? undefined) });
    } catch (e) {
      return handleError(c, e);
    }
  })

  .delete("/:id", async (c) => {
    try {
      const userId = c.get("userId");
      const id = c.req.param("id");
      const ctx = createContext(c.env, baseUrl(c));
      const card = await ctx.useCases.card.deleteCard(id, userId);
      if (!card) return c.json({ message: "カードが見つかりません" }, 404);
      return c.json({ card: cardView(card) });
    } catch (e) {
      return handleError(c, e);
    }
  });
