import { Hono } from 'hono';
import { Env } from '../middleware/auth';
import { createContext } from '../container';
import { cardView } from '../dto/ViewMapper';
import { baseUrl, handleError } from './helpers';
import { CardType } from '../../domain/card/Card';

export const nearbyRouter = new Hono<Env>()
  .get('/', async (c) => {
    try {
      const userId = c.get('userId');
      const lat = Number(c.req.query('lat'));
      const lon = Number(c.req.query('lon'));
      const radius = c.req.query('radius') ? Number(c.req.query('radius')) : undefined;
      const type = c.req.query('type') as CardType | undefined;

      const ctx = createContext(c.env, baseUrl(c));
      const result = await ctx.useCases.nearby.search({ userId, lat, lon, radiusKm: radius, type });

      const cards = [];
      for (const row of result.cards) {
        const owner = await ctx.repos.userRepo.findById(row.card.ownerId);
        cards.push(
          cardView(row.card, owner ?? undefined, undefined, {
            distanceKm: row.distanceKm,
            distanceLabel: row.distanceLabel,
          })
        );
      }
      return c.json({ cards, center: result.center, radiusKm: result.radiusKm });
    } catch (e) {
      return handleError(c, e);
    }
  });
