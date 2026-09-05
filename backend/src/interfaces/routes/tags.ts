import { Hono } from "hono";
import { Env } from "../middleware/auth";
import { createDb } from "../../infrastructure/db/database";
import { D1TagRepository } from "../../infrastructure/db/d1/D1TagRepository";
import { TagNormalizer } from "../../domain/tag/TagNormalizer";
import { TagVisionService } from "../../infrastructure/ai/TagVisionService";
import { TagInferUseCase } from "../../usecase/TagInferUseCase";
import { zValidator } from "../validation/validator";
import { tagsQuerySchema } from "../validation/schemas";
import { userRateLimit } from "../middleware/userRateLimit";
import { UploadPolicy } from "../../domain/upload/UploadPolicy";
import { handleError } from "./helpers";

const inferRateLimit = userRateLimit({ key: "tag-infer", limit: 20, windowSec: 3600 });

export const tagsRouter = new Hono<Env>()
  .get("/", zValidator("query", tagsQuerySchema), async (c) => {
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
  })

  .post("/infer-image", inferRateLimit, async (c) => {
    try {
      const form = await c.req.formData();
      const file = form.get("image");
      if (!(file instanceof File)) {
        return c.json({ message: "image ファイルが必要です" }, 400);
      }

      const contentType = UploadPolicy.validateContentType(file.type || "application/octet-stream");
      UploadPolicy.validateSize(file.size);

      const bytes = new Uint8Array(await file.arrayBuffer());
      const tagRepo = new D1TagRepository(createDb(c.env.DB));
      const vision = c.env.AI ? new TagVisionService(c.env.AI, c.env.WEBSEARCH) : undefined;
      const useCase = new TagInferUseCase(tagRepo, vision);
      const result = await useCase.inferFromImage(bytes, contentType);
      return c.json(result);
    } catch (e) {
      return handleError(c, e);
    }
  });
