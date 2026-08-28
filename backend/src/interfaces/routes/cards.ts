import { Hono } from 'hono';
import { Env } from '../middleware/auth';
import { createContext } from '../container';
import { cardView, groupView, matchView } from '../dto/ViewMapper';
import { ownerView } from '../dto/ViewMapper';
import { baseUrl, handleError } from './helpers';
import { TagNormalizer } from '../../domain/tag/TagNormalizer';
import { CardType } from '../../domain/card/Card';

export const cardsRouter = new Hono<Env>()
  .get('/', async (c) => {
    try {
      const ctx = createContext(c.env, baseUrl(c));
      const tags = (c.req.query('tags') || '').split(',').filter(Boolean);
      const minMatch = Number(c.req.query('minMatch') || '1');
      const type = c.req.query('type') as CardType | undefined;
      const cards = await ctx.useCases.card.searchCards(tags, minMatch, type || undefined);

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

  .post('/', async (c) => {
    try {
      const userId = c.get('userId');
      const body = await c.req.json<any>();
      const ctx = createContext(c.env, baseUrl(c));

      const tags = (body.tags || []).map((t: any) => ({
        displayName: t.name || t.displayName,
        category: t.category,
      }));
      const requiredTags = (body.requiredTags || []).map((t: any) => t.name || t);

      const result = await ctx.useCases.card.createCard({
        ownerId: userId,
        type: body.type,
        title: body.title,
        note: body.note,
        minMatchCount: body.minMatchCount,
        tags,
        requiredTags,
        dates: body.dates,
        location: body.location ?? undefined,
      });

      const owner = await ctx.repos.userRepo.findById(userId);
      const groupViews = [];
      for (const g of result.newGroups) {
        const detail = await ctx.useCases.group.getGroupDetail(g.id, userId);
        if (detail) {
          groupViews.push(groupView(detail.group, userId, detail.users, detail.cards, detail.lastReadAt));
        }
      }

      return c.json({
        card: cardView(result.card, owner ?? undefined),
        newMatches: result.newMatches.map((m) => ({
          matchId: m.matchId,
          matchCount: m.matchCount,
          matchedTags: m.matchedTags,
          card: cardView(m.card),
        })),
        newGroups: groupViews,
      }, 201);
    } catch (e) {
      return handleError(c, e);
    }
  })

  .get('/mine', async (c) => {
    try {
      const userId = c.get('userId');
      const ctx = createContext(c.env, baseUrl(c));
      const cards = await ctx.useCases.card.getMyCards(userId);
      return c.json({ cards: cards.map((card) => cardView(card)) });
    } catch (e) {
      return handleError(c, e);
    }
  })

  .get('/:id/matches', async (c) => {
    try {
      const userId = c.get('userId');
      const id = c.req.param('id');
      const ctx = createContext(c.env, baseUrl(c));
      const result = await ctx.useCases.card.getCardMatches(id, userId);
      if (!result) return c.json({ message: 'カードが見つかりません' }, 404);
      const views = [];
      for (const card of result.cards) {
        const owner = await ctx.repos.userRepo.findById(card.ownerId);
        views.push(cardView(card, owner ?? undefined));
      }
      return c.json({ cards: views, minMatchCount: result.minMatchCount });
    } catch (e) {
      return handleError(c, e);
    }
  })

  .get('/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const ctx = createContext(c.env, baseUrl(c));
      const card = await ctx.useCases.card.getCard(id);
      if (!card) return c.json({ message: 'カードが見つかりません' }, 404);
      const owner = await ctx.repos.userRepo.findById(card.ownerId);
      return c.json({ card: cardView(card, owner ?? undefined) });
    } catch (e) {
      return handleError(c, e);
    }
  })

  .delete('/:id', async (c) => {
    try {
      const userId = c.get('userId');
      const id = c.req.param('id');
      const ctx = createContext(c.env, baseUrl(c));
      const card = await ctx.useCases.card.deleteCard(id, userId);
      if (!card) return c.json({ message: 'カードが見つかりません' }, 404);
      return c.json({ card: cardView(card) });
    } catch (e) {
      return handleError(c, e);
    }
  });
