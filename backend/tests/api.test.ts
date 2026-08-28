import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { migrateToLatest } from '../src/infrastructure/db/migrate';
import app from '../src/index';
import { REFRESH_COOKIE } from '../src/interfaces/auth/cookies';

function readRefreshCookie(res: Response): string | undefined {
  const header = res.headers.get('Set-Cookie');
  if (!header) return undefined;
  const match = header.match(new RegExp(`${REFRESH_COOKIE}=([^;]+)`));
  return match?.[1];
}

describe('Web App Auth & API Integration Tests', () => {
  beforeEach(async () => {
    await migrateToLatest(env.DB);
  });

  it('GET /health returns 200 OK', async () => {
    const res = await app.request('/health', {}, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok', runtime: 'Cloudflare Workers (TypeScript)' });
  });

  it('Auth Flow: Signup, Login, Refresh (KV + Cookie), Protected Route', async () => {
    const signupRes = await app.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        displayName: 'テストユーザー',
      }),
    }, env);

    expect(signupRes.status).toBe(201);
    const signupData = await signupRes.json() as any;
    expect(signupData.user.email).toBe('test@example.com');
    expect(signupData.tokens.accessToken).toBeDefined();
    expect(signupData.tokens.refreshToken).toBeUndefined();

    const oldRefreshToken = readRefreshCookie(signupRes);
    expect(oldRefreshToken).toBeDefined();

    const storedKV = await env.CACHE_KV.get(`refresh:${oldRefreshToken}`);
    expect(storedKV).not.toBeNull();

    const meRes = await app.request('/api/me', {
      headers: { Authorization: `Bearer ${signupData.tokens.accessToken}` },
    }, env);

    expect(meRes.status).toBe(200);
    const meData = await meRes.json() as any;
    expect(meData.user.displayName).toBe('テストユーザー');

    const refreshRes = await app.request('/api/auth/refresh', {
      method: 'POST',
      headers: { Cookie: `${REFRESH_COOKIE}=${oldRefreshToken}` },
    }, env);

    expect(refreshRes.status).toBe(200);
    const refreshData = await refreshRes.json() as any;
    expect(refreshData.tokens.accessToken).toBeDefined();
    expect(refreshData.tokens.refreshToken).toBeUndefined();

    const newRefreshToken = readRefreshCookie(refreshRes);
    expect(newRefreshToken).toBeDefined();
    expect(newRefreshToken).not.toBe(oldRefreshToken);

    const revokedKV = await env.CACHE_KV.get(`refresh:${oldRefreshToken}`);
    expect(revokedKV).toBeNull();

    const newKV = await env.CACHE_KV.get(`refresh:${newRefreshToken}`);
    expect(newKV).not.toBeNull();

    const logoutRes = await app.request('/api/auth/logout', {
      method: 'POST',
      headers: { Cookie: `${REFRESH_COOKIE}=${newRefreshToken}` },
    }, env);

    expect(logoutRes.status).toBe(200);
    const loggedOutKV = await env.CACHE_KV.get(`refresh:${newRefreshToken}`);
    expect(loggedOutKV).toBeNull();
  });

  it('POST /api/cards creates card and triggers matching with Access Token', async () => {
    const user1Res = await app.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user1@example.com', password: 'password', displayName: 'ユーザー1' }),
    }, env);
    const user1Data = await user1Res.json() as any;

    const user2Res = await app.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user2@example.com', password: 'password', displayName: 'ユーザー2' }),
    }, env);
    const user2Data = await user2Res.json() as any;

    await app.request('/api/cards', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user1Data.tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'GIVE',
        title: '司アクスタ譲ります',
        minMatchCount: 2,
        tags: [
          { displayName: 'プロセカ' },
          { displayName: '天馬司' },
          { displayName: 'アクスタ' },
        ],
      }),
    }, env);

    const card2Res = await app.request('/api/cards', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user2Data.tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'WANT',
        title: '司アクスタ求めます',
        minMatchCount: 2,
        tags: [
          { displayName: 'プロセカ' },
          { displayName: '天馬司' },
          { displayName: '缶バッジ' },
        ],
      }),
    }, env);

    expect(card2Res.status).toBe(201);

    const matchRes = await app.request('/api/matches', {
      headers: { Authorization: `Bearer ${user1Data.tokens.accessToken}` },
    }, env);

    expect(matchRes.status).toBe(200);
    const matchData = await matchRes.json() as any;
    expect(matchData.matches.length).toBe(1);
    expect(matchData.matches[0].matchCount).toBe(2);
  });
});
