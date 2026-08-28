import { Hono } from "hono";
import { Env } from "../middleware/auth";
import { createContext } from "../container";
import { matchView, messageView } from "../dto/ViewMapper";
import { baseUrl, handleError } from "./helpers";
import { zValidator } from "../validation/validator";
import { messagesAfterQuerySchema, sendMessageSchema } from "../validation/schemas";

export const matchesRouter = new Hono<Env>()
  .get("/", async (c) => {
    try {
      const userId = c.get("userId");
      const ctx = createContext(c.env, baseUrl(c));
      const matches = await ctx.useCases.match.getMyMatches(userId);
      const views = [];
      for (const m of matches) {
        const detail = await ctx.useCases.match.getMatchDetail(m.id, userId);
        if (detail) {
          views.push(
            matchView(
              detail.match,
              userId,
              detail.partner,
              detail.partnerCard,
              detail.myCard,
              detail.iGive,
              detail.iReceive,
              detail.lastReadAt,
            ),
          );
        }
      }
      return c.json({ matches: views });
    } catch (e) {
      return handleError(c, e);
    }
  })

  .get("/:id", async (c) => {
    try {
      const userId = c.get("userId");
      const id = c.req.param("id");
      const ctx = createContext(c.env, baseUrl(c));
      const detail = await ctx.useCases.match.getMatchDetail(id, userId);
      if (!detail) return c.json({ message: "マッチが見つかりません" }, 404);
      return c.json({
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
      });
    } catch (e) {
      return handleError(c, e);
    }
  })

  .post("/:id/accept", async (c) => {
    try {
      const userId = c.get("userId");
      const id = c.req.param("id");
      const ctx = createContext(c.env, baseUrl(c));
      const result = await ctx.useCases.match.accept(id, userId);
      if (!result) return c.json({ message: "マッチが見つかりません" }, 404);
      const detail = await ctx.useCases.match.getMatchDetail(id, userId);
      if (!detail) return c.json({ message: "マッチが見つかりません" }, 404);
      return c.json({
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
        bothAccepted: result.bothAccepted,
      });
    } catch (e) {
      return handleError(c, e);
    }
  })

  .post("/:id/decline", async (c) => {
    try {
      const userId = c.get("userId");
      const id = c.req.param("id");
      const ctx = createContext(c.env, baseUrl(c));
      const match = await ctx.useCases.match.decline(id, userId);
      if (!match) return c.json({ message: "マッチが見つかりません" }, 404);
      const detail = await ctx.useCases.match.getMatchDetail(id, userId);
      if (!detail) return c.json({ message: "マッチが見つかりません" }, 404);
      return c.json({
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
      });
    } catch (e) {
      return handleError(c, e);
    }
  })

  .post("/:id/complete", async (c) => {
    try {
      const userId = c.get("userId");
      const id = c.req.param("id");
      const ctx = createContext(c.env, baseUrl(c));
      const match = await ctx.useCases.match.complete(id, userId);
      if (!match) return c.json({ message: "マッチが見つかりません" }, 404);
      const detail = await ctx.useCases.match.getMatchDetail(id, userId);
      if (!detail) return c.json({ message: "マッチが見つかりません" }, 404);
      return c.json({
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
      });
    } catch (e) {
      return handleError(c, e);
    }
  })

  .get("/:id/messages", zValidator("query", messagesAfterQuerySchema), async (c) => {
    try {
      const userId = c.get("userId");
      const id = c.req.param("id");
      const query = c.req.valid("query");
      const ctx = createContext(c.env, baseUrl(c));
      const result = await ctx.useCases.message.listMatchMessages(id, userId, query.after);
      const messages = [];
      for (const m of result.messages) {
        messages.push(await messageView(m, userId, (key) => ctx.useCases.message.getImageUrl(key)));
      }
      return c.json({
        messages,
        canSend: result.canSend,
        status: result.status,
        partner: result.partner
          ? (await import("../dto/ViewMapper")).ownerView(result.partner)
          : null,
      });
    } catch (e) {
      return handleError(c, e);
    }
  })

  .post("/:id/messages", zValidator("json", sendMessageSchema), async (c) => {
    try {
      const userId = c.get("userId");
      const id = c.req.param("id");
      const body = c.req.valid("json");
      const ctx = createContext(c.env, baseUrl(c));
      const result = await ctx.useCases.message.sendMatchMessage(id, userId, body);
      const view = await messageView(result.message, userId, (key) =>
        ctx.useCases.message.getImageUrl(key),
      );
      return c.json({ message: view, notified: result.notified });
    } catch (e) {
      return handleError(c, e);
    }
  });
