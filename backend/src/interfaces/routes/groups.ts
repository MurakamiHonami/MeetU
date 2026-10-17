import { Hono } from "hono";
import { Env } from "../middleware/auth";
import { createContext } from "../container";
import { groupView, messageView, ownerView } from "../dto/ViewMapper";
import { baseUrl, handleError } from "./helpers";
import { zValidator } from "../validation/validator";
import { messagesAfterQuerySchema, sendMessageSchema } from "../validation/schemas";

export const groupsRouter = new Hono<Env>()
  .get("/", async (c) => {
    try {
      const userId = c.get("userId");
      const ctx = createContext(c.env, baseUrl(c));
      const groups = await ctx.useCases.group.getMyGroups(userId);
      const { users, cards, readAts } = await ctx.useCases.group.loadGroupContext(groups, userId);
      return c.json({
        groups: groups.map((g) => groupView(g, userId, users, cards, readAts.get(g.id) ?? null)),
      });
    } catch (e) {
      return handleError(c, e);
    }
  })

  .get("/:id", async (c) => {
    try {
      const userId = c.get("userId");
      const id = c.req.param("id");
      const ctx = createContext(c.env, baseUrl(c));
      const detail = await ctx.useCases.group.getGroupDetail(id, userId);
      if (!detail) return c.json({ message: "グループが見つかりません" }, 404);
      return c.json({
        group: groupView(detail.group, userId, detail.users, detail.cards, detail.lastReadAt),
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
      const result = await ctx.useCases.group.accept(id, userId);
      if (!result) return c.json({ message: "グループが見つかりません" }, 404);
      const detail = await ctx.useCases.group.getGroupDetail(id, userId);
      if (!detail) return c.json({ message: "グループが見つかりません" }, 404);
      return c.json({
        group: groupView(detail.group, userId, detail.users, detail.cards, detail.lastReadAt),
        established: result.established,
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
      const group = await ctx.useCases.group.decline(id, userId);
      if (!group) return c.json({ message: "グループが見つかりません" }, 404);
      const detail = await ctx.useCases.group.getGroupDetail(id, userId);
      if (!detail) return c.json({ message: "グループが見つかりません" }, 404);
      return c.json({
        group: groupView(detail.group, userId, detail.users, detail.cards, detail.lastReadAt),
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
      const group = await ctx.useCases.group.complete(id, userId);
      if (!group) return c.json({ message: "グループが見つかりません" }, 404);
      const detail = await ctx.useCases.group.getGroupDetail(id, userId);
      if (!detail) return c.json({ message: "グループが見つかりません" }, 404);
      return c.json({
        group: groupView(detail.group, userId, detail.users, detail.cards, detail.lastReadAt),
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
      const result = await ctx.useCases.message.listGroupMessages(id, userId, query.after);
      const senders = await ctx.repos.userRepo.findByIds(result.messages.map((m) => m.senderId));
      const senderById = new Map(senders.map((sender) => [sender.id, sender]));
      const messages = await Promise.all(
        result.messages.map(async (m) => {
          const view = await messageView(m, userId, (key) => ctx.useCases.message.getImageUrl(key));
          const sender = senderById.get(m.senderId);
          return { ...view, sender: sender ? ownerView(sender) : null };
        }),
      );
      return c.json({
        messages,
        canSend: result.canSend,
        status: result.status,
        members: result.members.map((m) => ownerView(m)),
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
      const result = await ctx.useCases.message.sendGroupMessage(id, userId, body);
      const view = await messageView(result.message, userId, (key) =>
        ctx.useCases.message.getImageUrl(key),
      );
      return c.json({ message: view });
    } catch (e) {
      return handleError(c, e);
    }
  });
