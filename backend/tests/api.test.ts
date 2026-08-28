import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { migrateToLatest } from '../src/infrastructure/db/migrate';
import app from '../src/index';

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

  it('Auth Flow: Signup, Login, Refresh (KV), Protected Route', async () => {
    // 1. Signup
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
    expect(signupData.tokens.refreshToken).toBeDefined();

    const oldRefreshToken = signupData.tokens.refreshToken;

    // KV に Refresh Token が存続しているか検証
    const storedKV = await env.CACHE_KV.get(`refresh:${oldRefreshToken}`);
    expect(storedKV).not.toBeNull();

    // 2. Protected Route Access (/api/me)
    const meRes = await app.request('/api/me', {
      headers: { Authorization: `Bearer ${signupData.tokens.accessToken}` },
    }, env);

    expect(meRes.status).toBe(200);
    const meData = await meRes.json() as any;
    expect(meData.user.displayName).toBe('テストユーザー');

    // 3. Refresh Token Rotation (/api/auth/refresh)
    const refreshRes = await app.request('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: oldRefreshToken }),
    }, env);

    expect(refreshRes.status).toBe(200);
    const refreshData = await refreshRes.json() as any;
    const newRefreshToken = refreshData.tokens.refreshToken;
    expect(newRefreshToken).toBeDefined();
    expect(newRefreshToken).not.toBe(oldRefreshToken);

    // 古い Refresh Token は KV から失効削除されていること
    const revokedKV = await env.CACHE_KV.get(`refresh:${oldRefreshToken}`);
    expect(revokedKV).toBeNull();

    // 新しい Refresh Token は KV に存在すること
    const newKV = await env.CACHE_KV.get(`refresh:${newRefreshToken}`);
    expect(newKV).not.toBeNull();

    // 4. Logout (/api/auth/logout)
    const logoutRes = await app.request('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: newRefreshToken }),
    }, env);

    expect(logoutRes.status).toBe(200);
    const loggedOutKV = await env.CACHE_KV.get(`refresh:${newRefreshToken}`);
    expect(loggedOutKV).toBeNull(); // KV から完全に削除されていること
  });

  it('POST /api/cards creates card and triggers matching with Access Token', async () => {
    // ユーザー1 登録
    const user1Res = await app.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user1@example.com', password: 'password', displayName: 'ユーザー1' }),
    }, env);
    const user1Data = await user1Res.json() as any;

    // ユーザー2 登録
    const user2Res = await app.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user2@example.com', password: 'password', displayName: 'ユーザー2' }),
    }, env);
    const user2Data = await user2Res.json() as any;

    // ユーザー1: 譲カード作成
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
          { displayName: 'アクスタ' }
        ],
      }),
    }, env);

    // ユーザー2: 求カード作成
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
          { displayName: '缶バッジ' }
        ],
      }),
    }, env);

    expect(card2Res.status).toBe(201);

    // ユーザー1のマッチ一覧を取得して確認
    const matchRes = await app.request('/api/matches', {
      headers: { Authorization: `Bearer ${user1Data.tokens.accessToken}` },
    }, env);

    expect(matchRes.status).toBe(200);
    const matchData = await matchRes.json() as any;
    expect(matchData.matches.length).toBe(1);
    expect(matchData.matches[0].matchCount).toBe(2);
  });
});
