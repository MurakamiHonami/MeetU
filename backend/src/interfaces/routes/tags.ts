import { Hono } from "hono";
import { Env } from "../middleware/auth";
import { createDb } from "../../infrastructure/db/database";
import { D1TagRepository } from "../../infrastructure/db/d1/D1TagRepository";
import { TagNormalizer } from "../../domain/tag/TagNormalizer";
import { zValidator } from "../validation/validator";
import { tagsQuerySchema } from "../validation/schemas";

export const tagsRouter = new Hono<Env>().get(
  "/",
  zValidator("query", tagsQuerySchema),
  async (c) => {
    const query = c.req.valid("query");

    const tagRepo = new D1TagRepository(createDb(c.env.DB));
    const tags = await tagRepo.suggest(query.q, query.limit);

    const normalized = TagNormalizer.normalize(query.q);
    const exact = tags.find((t) => t.id === normalized);
    const response: {
      tags: { tagId: string; name: string; category: string; useCount: number }[];
      createCandidate?: { tagId: string; name: string; isNew: boolean };
    } = {
      tags: tags.map((t) => ({
        tagId: t.id,
        name: t.displayName,
        category: t.category,
        useCount: t.useCount,
      })),
    };

    if (query.q.trim() && !exact) {
      response.createCandidate = { tagId: normalized, name: query.q.trim(), isNew: true };
    }

    return c.json(response);
  },
);
