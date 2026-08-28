import { Hono } from "hono";
import { Env } from "../middleware/auth";
import { createContext } from "../container";
import { cardView, groupView } from "../dto/ViewMapper";
import { baseUrl, handleError } from "./helpers";
import { zValidator } from "../validation/validator";
import {
  cardsSearchQuerySchema,
  createCardSchema,
  respondToCardSchema,
} from "../validation/schemas";
import { matchView } from "../dto/ViewMapper";

export const cardsRouter = new Hono<Env>()
  .get("/", zValidator("query", cardsSearchQuerySchema), async (c) => {
    try {
      const query = c.req.valid("query");
      const ctx = createContext(c.env, baseUrl(c));
      const tags = query.tags.split(",").filter(Boolean);
      const cards = await ctx.useCases.card.searchCards(tags, query.minMatch, query.type);

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

  .post("/", zValidator("json", createCardSchema), async (c) => {
    try {
      const userId = c.get("userId");
      const body = c.req.valid("json");
      const ctx = createContext(c.env, baseUrl(c));

      const tags = body.tags.map((t) => ({
        displayName: t.name || t.displayName || "",
        category: t.category,
      }));
      const requiredTags = (body.requiredTags || []).map((t) =>
        typeof t === "string" ? t : t.name,
      );

      const result = await ctx.useCases.card.createCard({
        ownerId: userId,
        type: body.type,
        title: body.title,
        note: body.note,
        minMatchCount: body.minMatchCount,
        tags,
        requiredTags,
        dates: body.dates,
        location: body.location ?? undefined,
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

  .get("/:id/respond-options", async (c) => {
    try {
      const userId = c.get("userId");
      const id = c.req.param("id");
      const ctx = createContext(c.env, baseUrl(c));
      const result = await ctx.useCases.card.getRespondOptions(userId, id);
      if (!result) return c.json({ message: "カードが見つかりません" }, 404);

      const targetOwner = await ctx.repos.userRepo.findById(result.target.ownerId);
      const options = [];
      for (const opt of result.options) {
        options.push({
          card: cardView(opt.card),
          matchedTags: opt.matchedTags,
          matchCount: opt.matchCount,
        });
      }
      return c.json({
        targetCard: cardView(result.target, targetOwner ?? undefined),
        options,
      });
    } catch (e) {
      return handleError(c, e);
    }
  })

  .post("/:id/respond", zValidator("json", respondToCardSchema), async (c) => {
    try {
      const userId = c.get("userId");
      const id = c.req.param("id");
      const body = c.req.valid("json");

      const ctx = createContext(c.env, baseUrl(c));
      const { match, created } = await ctx.useCases.card.respondToCard(userId, id, body.myCardId);
      const detail = await ctx.useCases.match.getMatchDetail(match.id, userId);
      if (!detail) return c.json({ message: "マッチが見つかりません" }, 404);

      return c.json(
        {
          created,
          match: matchView(
            detail.match,
            userId,
            detail.partner,
            detail.partnerCard,
            detail.myCard,
            detail.iGive,
            detail.iReceive,
            detail.lastReadAt,
          ),
        },
        created ? 201 : 200,
      );
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
