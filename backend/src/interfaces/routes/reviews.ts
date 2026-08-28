import { Hono } from "hono";
import { Env } from "../middleware/auth";
import { createContext } from "../container";
import { baseUrl, handleError } from "./helpers";
import { zValidator } from "../validation/validator";
import { createReportSchema, createReviewSchema } from "../validation/schemas";

export const reviewsRouter = new Hono<Env>().post(
  "/",
  zValidator("json", createReviewSchema),
  async (c) => {
    try {
      const userId = c.get("userId");
      const body = c.req.valid("json");
      const ctx = createContext(c.env, baseUrl(c));
      const review = await ctx.useCases.review.createReview({
        matchId: body.matchId,
        fromUserId: userId,
        rating: body.rating,
        comment: body.comment,
      });
      return c.json({ review: review.toProps() });
    } catch (e) {
      return handleError(c, e);
    }
  },
);

export const reportsRouter = new Hono<Env>().post(
  "/",
  zValidator("json", createReportSchema),
  async (c) => {
    try {
      const userId = c.get("userId");
      const body = c.req.valid("json");
      const ctx = createContext(c.env, baseUrl(c));
      const report = await ctx.useCases.report.createReport({
        reporterId: userId,
        targetUserId: body.targetUserId,
        matchId: body.matchId,
        reason: body.reason,
        detail: body.detail,
      });
      return c.json({
        reportId: report.id,
        message: "通報を受け付けました。内容を確認いたします。",
      });
    } catch (e) {
      return handleError(c, e);
    }
  },
);
