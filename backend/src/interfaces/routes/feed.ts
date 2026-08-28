import { Hono } from 'hono';
import { Env } from '../middleware/auth';
import { createContext } from '../container';
import { cardView } from '../dto/ViewMapper';
import { baseUrl, handleError } from './helpers';

export const feedRouter = new Hono<Env>()
  .get('/', async (c) => {
    try {
      const userId = c.get('userId');
      const ctx = createContext(c.env, baseUrl(c));
      const feed = await ctx.useCases.feed.getFeed(userId);
      const cards = [];
      for (const row of feed.cards) {
        const owner = await ctx.repos.userRepo.findById(row.card.ownerId);
        cards.push(
          cardView(row.card, owner ?? undefined, row.reasonTags, {
            score: row.score,
            reasonTags: row.reasonTags.map((t) => row.card.tagLabels[t] ?? t),
          })
        );
      }
      return c.json({ cards, hasFavorites: feed.hasFavorites });
    } catch (e) {
      return handleError(c, e);
    }
  })

  .post('/:cardId/save', async (c) => {
    try {
      const userId = c.get('userId');
      const cardId = c.req.param('cardId');
      const ctx = createContext(c.env, baseUrl(c));
      await ctx.useCases.feed.saveCard(userId, cardId);
      return c.json({ cardId });
    } catch (e) {
      return handleError(c, e);
    }
  })

  .post('/:cardId/skip', async (c) => {
    try {
      const userId = c.get('userId');
      const cardId = c.req.param('cardId');
      const ctx = createContext(c.env, baseUrl(c));
      await ctx.useCases.feed.skipCard(userId, cardId);
      return c.json({ cardId });
    } catch (e) {
      return handleError(c, e);
    }
  });

export const savedRouter = new Hono<Env>()
  .get('/', async (c) => {
    try {
      const userId = c.get('userId');
      const ctx = createContext(c.env, baseUrl(c));
      const cards = await ctx.useCases.feed.getSavedCards(userId);
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

  .delete('/:cardId', async (c) => {
    try {
      const userId = c.get('userId');
      const cardId = c.req.param('cardId');
      const ctx = createContext(c.env, baseUrl(c));
      await ctx.useCases.feed.unsaveCard(userId, cardId);
      return c.json({ cardId });
    } catch (e) {
      return handleError(c, e);
    }
  });
