import { Hono } from 'hono';
import { Env } from '../middleware/auth';
import { createContext } from '../container';
import { ownerView } from '../dto/ViewMapper';
import { baseUrl, handleError } from './helpers';
import { Location } from '../../domain/shared/Location';

export const meRouter = new Hono<Env>()
  .get('/', async (c) => {
    try {
      const userId = c.get('userId');
      const ctx = createContext(c.env, baseUrl(c));
      const profile = await ctx.useCases.user.getProfile(userId);
      if (!profile) return c.json({ message: 'ユーザーが見つかりません' }, 404);
      return c.json({
        user: { ...ownerView(profile.user), cardCount: profile.cardCount },
      });
    } catch (e) {
      return handleError(c, e);
    }
  })

  .get('/reviews', async (c) => {
    try {
      const userId = c.get('userId');
      const ctx = createContext(c.env, baseUrl(c));
      const reviews = await ctx.useCases.user.getMyReviews(userId);
      return c.json({ reviews });
    } catch (e) {
      return handleError(c, e);
    }
  })

  .put('/', async (c) => {
    try {
      const userId = c.get('userId');
      const body = await c.req.json<any>();
      const ctx = createContext(c.env, baseUrl(c));

      let user;
      if (body.favorites !== undefined) {
        user = await ctx.useCases.user.updateFavorites(userId, body.favorites);
      } else if (body.homeLocation !== undefined) {
        const loc = body.homeLocation
          ? Location.tryParse(body.homeLocation)?.toJSON() ?? null
          : null;
        user = await ctx.useCases.user.updateHome(userId, loc);
      } else if (body.displayName) {
        user = await ctx.useCases.user.updateProfile(userId, body.displayName, body.pictureUrl);
      } else {
        return c.json({ message: '更新内容を指定してください' }, 400);
      }

      if (!user) return c.json({ message: 'ユーザーが見つかりません' }, 404);
      return c.json({ user: ownerView(user) });
    } catch (e) {
      return handleError(c, e);
    }
  });
