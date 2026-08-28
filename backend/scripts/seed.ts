/**
 * デモ用シードデータを API 経由で投入する。
 *
 * 使い方:
 *   npm run db:seed              # ローカル (http://127.0.0.1:8787)
 *   npm run db:seed:staging      # staging Workers
 *   API_BASE=... tsx scripts/seed.ts [--force]
 *
 * デモアカウント: seed-*@meetu.local / seedpass123
 */
import { SEED_PASSWORD, SEED_USERS } from './seed-data';

const STAGING_API = 'https://api-meetu-staging.ruxel.net';
const LOCAL_API = 'http://127.0.0.1:8787';

const args = process.argv.slice(2);
const force = args.includes('--force');
const staging = args.includes('--staging');
const apiBase = (process.env.API_BASE ?? (staging ? STAGING_API : LOCAL_API)).replace(/\/$/, '');

type Tokens = { accessToken: string; refreshToken: string };

async function request<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: T }> {
  const headers: Record<string, string> = {
  ...(init.headers as Record<string, string> | undefined),
  };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${apiBase}${path}`, { ...init, headers });
  const body = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, body };
}

async function ensureUser(email: string, displayName: string): Promise<Tokens> {
  const signup = await request<{ tokens: Tokens; error?: string }>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password: SEED_PASSWORD, displayName }),
  });
  if (signup.status === 201) return signup.body.tokens;

  if (signup.status !== 409) {
    throw new Error(`signup failed for ${email}: ${signup.status} ${JSON.stringify(signup.body)}`);
  }

  const login = await request<{ tokens: Tokens; error?: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: SEED_PASSWORD }),
  });
  if (login.status !== 200) {
    throw new Error(`login failed for ${email}: ${login.status} ${JSON.stringify(login.body)}`);
  }
  return login.body.tokens;
}

async function main() {
  console.log(`Seeding via ${apiBase}${force ? ' (force)' : ''}`);

  const health = await request<{ status: string }>('/health');
  if (health.status !== 200) {
    throw new Error(`API unreachable (${health.status}). Start backend or set API_BASE.`);
  }

  let createdCards = 0;
  let skippedUsers = 0;

  for (const user of SEED_USERS) {
    const tokens = await ensureUser(user.email, user.displayName);
    const me = await request<{ user: { cardCount: number } }>('/api/me', { token: tokens.accessToken });
    if (me.status !== 200) {
      throw new Error(`GET /api/me failed for ${user.email}: ${me.status}`);
    }

    if (!force && me.body.user.cardCount > 0) {
      console.log(`  skip ${user.displayName} (${user.email}) — already has ${me.body.user.cardCount} cards`);
      skippedUsers += 1;
      continue;
    }

    if (user.favorites?.length) {
      await request('/api/me', {
        method: 'PUT',
        token: tokens.accessToken,
        body: JSON.stringify({ favorites: user.favorites.map((name) => ({ name })) }),
      });
    }

    if (user.home) {
      await request('/api/me', {
        method: 'PUT',
        token: tokens.accessToken,
        body: JSON.stringify({ homeLocation: user.home }),
      });
    }

    for (const card of user.cards) {
      const res = await request('/api/cards', {
        method: 'POST',
        token: tokens.accessToken,
        body: JSON.stringify({
          type: card.type,
          title: card.title,
          note: card.note,
          minMatchCount: card.minMatchCount ?? 2,
          tags: card.tags.map((displayName) => ({ displayName })),
          location: card.location,
        }),
      });
      if (res.status !== 201) {
        throw new Error(`create card failed for ${user.email}: ${res.status} ${JSON.stringify(res.body)}`);
      }
      createdCards += 1;
      console.log(`  + [${user.displayName}] ${card.type} ${card.title}`);
    }
  }

  console.log(`Done. created ${createdCards} cards, skipped ${skippedUsers} users.`);
  console.log(`Demo login: seed-yuki@meetu.local / ${SEED_PASSWORD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
