import { Hono } from "hono";
import { Env } from "../middleware/auth";
import { createContext } from "../container";
import { baseUrl, handleError } from "./helpers";
import { zValidator } from "../validation/validator";
import {
  addReadingItemSchema,
  listReadingItemForTradeSchema,
  listReadingItemsQuerySchema,
  updateReadingItemSchema,
} from "../validation/schemas";

export const readingRouter = new Hono<Env>()
  .get("/", zValidator("query", listReadingItemsQuerySchema), async (c) => {
    try {
      const userId = c.get("userId");
      const { status } = c.req.valid("query");
      const ctx = createContext(c.env, baseUrl(c));
      const items = await ctx.useCases.reading.list(userId, status);
      return c.json({ items: items.map((i) => i.toProps()) });
    } catch (e) {
      return handleError(c, e);
    }
  })
  .post("/", zValidator("json", addReadingItemSchema), async (c) => {
    try {
      const userId = c.get("userId");
      const body = c.req.valid("json");
      const ctx = createContext(c.env, baseUrl(c));
      const item = await ctx.useCases.reading.add({ ownerId: userId, ...body });
      return c.json({ item: item.toProps() });
    } catch (e) {
      return handleError(c, e);
    }
  })
  .patch("/:id", zValidator("json", updateReadingItemSchema), async (c) => {
    try {
      const userId = c.get("userId");
      const id = c.req.param("id");
      const body = c.req.valid("json");
      const ctx = createContext(c.env, baseUrl(c));
      const { status, ...fields } = body;
      let item = await ctx.useCases.reading.edit(userId, id, fields);
      if (status) item = await ctx.useCases.reading.changeStatus(userId, id, status);
      return c.json({ item: item.toProps() });
    } catch (e) {
      return handleError(c, e);
    }
  })
  .delete("/:id", async (c) => {
    try {
      const userId = c.get("userId");
      const id = c.req.param("id");
      const ctx = createContext(c.env, baseUrl(c));
      await ctx.useCases.reading.remove(userId, id);
      return c.json({ ok: true });
    } catch (e) {
      return handleError(c, e);
    }
  })
  .post("/:id/list-for-trade", zValidator("json", listReadingItemForTradeSchema), async (c) => {
    try {
      const userId = c.get("userId");
      const id = c.req.param("id");
      const body = c.req.valid("json");
      const ctx = createContext(c.env, baseUrl(c));
      const { item, trade } = await ctx.useCases.reading.listForTrade(userId, id, {
        tags: body.tags.map((t) => ({
          displayName: (t.displayName ?? t.name)!,
          category: t.category,
        })),
        note: body.note,
      });
      return c.json({
        item: item.toProps(),
        card: trade.card.toProps(),
        newMatches: trade.newMatches.map((m) => ({
          matchId: m.matchId,
          matchCount: m.matchCount,
          matchedTags: m.matchedTags,
        })),
      });
    } catch (e) {
      return handleError(c, e);
    }
  });
