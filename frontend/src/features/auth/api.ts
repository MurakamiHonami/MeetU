import {
  client,
  clearAccessToken,
  setAccessToken,
  unwrap,
  type AuthTokens,
} from "../../shared/api";

export async function signup(input: { email: string; password: string; displayName: string }) {
  const res = await client.api.auth.signup.$post({ json: input });
  const data = await unwrap<{
    user: { id: string; email: string; displayName: string };
    tokens: AuthTokens;
  }>(res);
  setAccessToken(data.tokens.accessToken);
  return data;
}

export async function login(input: { email: string; password: string }) {
  const res = await client.api.auth.login.$post({ json: input });
  const data = await unwrap<{
    user: { id: string; email: string; displayName: string };
    tokens: AuthTokens;
  }>(res);
  setAccessToken(data.tokens.accessToken);
  return data;
}

export async function logout() {
  const res = await client.api.auth.logout.$post({});
  return unwrap<{ success: boolean }>(res);
}

export async function signOut(): Promise<void> {
  try {
    await logout();
  } catch {
    // サーバー側失敗でもローカルはクリアする
  } finally {
    clearAccessToken();
  }
}
