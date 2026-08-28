import { Hono } from 'hono';
import { authMiddleware, Env } from './interfaces/middleware/auth';
import { corsMiddleware } from './interfaces/middleware/cors';
import { authRouter } from './interfaces/routes/auth';
import { meRouter } from './interfaces/routes/me';
import { cardsRouter } from './interfaces/routes/cards';
import { matchesRouter } from './interfaces/routes/matches';
import { tagsRouter } from './interfaces/routes/tags';
import { groupsRouter } from './interfaces/routes/groups';
import { feedRouter, savedRouter } from './interfaces/routes/feed';
import { nearbyRouter } from './interfaces/routes/nearby';
import { reviewsRouter, reportsRouter } from './interfaces/routes/reviews';
import { uploadsRouter } from './interfaces/routes/uploads';

const app = new Hono<Env>()
  .use('*', corsMiddleware())
  .get('/health', (c) => c.json({ status: 'ok', runtime: 'Cloudflare Workers (TypeScript)' }))
  .route('/api/auth', authRouter)
  // アップロード PUT/GET はトークン認証のため auth ミドルウェアの外
  .route('/api/uploads', uploadsRouter)
  .use('/api/*', authMiddleware)
  .route('/api/me', meRouter)
  .route('/api/cards', cardsRouter)
  .route('/api/matches', matchesRouter)
  .route('/api/tags', tagsRouter)
  .route('/api/groups', groupsRouter)
  .route('/api/feed', feedRouter)
  .route('/api/saved', savedRouter)
  .route('/api/nearby', nearbyRouter)
  .route('/api/reviews', reviewsRouter)
  .route('/api/reports', reportsRouter);

export type AppType = typeof app;

export default app;
