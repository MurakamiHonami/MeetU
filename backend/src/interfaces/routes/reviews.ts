import { Hono } from "hono";
import { Env } from "../middleware/auth";
import { createContext } from "../container";
import { baseUrl, handleError } from "./helpers";
import { parseJson, readJsonBody } from "../validation/parseRequest";
import { createReportSchema, createReviewSchema } from "../validation/schemas";

export const reviewsRouter = new Hono<Env>().post("/", async (c) => {
  try {
    const userId = c.get("userId");
    const raw = await readJsonBody(c);
    if (!raw.ok) return raw.response;
    const parsed = parseJson(c, createReviewSchema, raw.data);
    if (!parsed.ok) return parsed.response;
    const ctx = createContext(c.env, baseUrl(c));
    const review = await ctx.useCases.review.createReview({
      matchId: parsed.data.matchId,
      fromUserId: userId,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    });
    return c.json({ review: review.toProps() });
  } catch (e) {
    return handleError(c, e);
  }
});

export const reportsRouter = new Hono<Env>().post("/", async (c) => {
  try {
    const userId = c.get("userId");
    const raw = await readJsonBody(c);
    if (!raw.ok) return raw.response;
    const parsed = parseJson(c, createReportSchema, raw.data);
    if (!parsed.ok) return parsed.response;
    const ctx = createContext(c.env, baseUrl(c));
    const report = await ctx.useCases.report.createReport({
      reporterId: userId,
      targetUserId: parsed.data.targetUserId,
      matchId: parsed.data.matchId,
      reason: parsed.data.reason,
      detail: parsed.data.detail,
    });
    return c.json({
      reportId: report.id,
      message: "通報を受け付けました。内容を確認いたします。",
    });
  } catch (e) {
    return handleError(c, e);
  }
});
