import { Context, Hono } from "hono";
import { Env } from "../middleware/auth";
import { mockUserIdFromToken } from "../middleware/mockAuth";
import { AuthService } from "../../infrastructure/auth/AuthService";
import { createContext } from "../container";
import { baseUrl, handleError } from "./helpers";
import { zValidator } from "../validation/validator";
import { createUploadTicketSchema } from "../validation/schemas";

async function requireUserId(c: Context<Env>): Promise<string | null> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.substring(7);
  const mockUserId = mockUserIdFromToken(c, token);
  if (mockUserId) return mockUserId;
  const payload = await AuthService.verifyAccessToken(token, c.env.JWT_SECRET);
  return payload?.userId ?? null;
}

export const uploadsRouter = new Hono<Env>()
  .post("/", zValidator("json", createUploadTicketSchema), async (c) => {
    try {
      const userId = await requireUserId(c);
      if (!userId) return c.json({ message: "Unauthorized" }, 401);
      const body = c.req.valid("json");
      const ctx = createContext(c.env, baseUrl(c));
      const ticket = await ctx.useCases.upload.createUploadTicket(userId, body);
      return c.json(ticket);
    } catch (e) {
      return handleError(c, e);
    }
  })

  .put("/put", async (c) => {
    try {
      const token = c.req.query("token");
      if (!token) return c.json({ message: "token が必要です" }, 400);
      const ctx = createContext(c.env, baseUrl(c));
      await ctx.uploadService.handlePut(token, c.req.raw.body);
      return c.json({ success: true });
    } catch (e) {
      return handleError(c, e);
    }
  })

  .get("/view", async (c) => {
    try {
      const token = c.req.query("token");
      if (!token) return c.json({ message: "token が必要です" }, 400);
      const ctx = createContext(c.env, baseUrl(c));
      const result = await ctx.uploadService.handleView(token);
      if (!result) return c.json({ message: "画像が見つかりません" }, 404);
      return new Response(result.body, {
        headers: { "Content-Type": result.contentType, "Cache-Control": "private, max-age=3600" },
      });
    } catch (e) {
      return handleError(c, e);
    }
  });
