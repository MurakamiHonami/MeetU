import { Hono } from 'hono';
import { Env } from '../middleware/auth';
import { createDb } from '../../infrastructure/db/database';
import { D1TagRepository } from '../../infrastructure/db/d1/D1TagRepository';
import { TagNormalizer } from '../../domain/tag/TagNormalizer';

export const tagsRouter = new Hono<Env>()
  .get('/', async (c) => {
    const query = c.req.query('q') || '';
    const limitStr = c.req.query('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : 20;

    const tagRepo = new D1TagRepository(createDb(c.env.DB));
    const tags = await tagRepo.suggest(query, limit);

    const normalized = TagNormalizer.normalize(query);
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

    if (query.trim() && !exact) {
      response.createCandidate = { tagId: normalized, name: query.trim(), isNew: true };
    }

    return c.json(response);
  });
