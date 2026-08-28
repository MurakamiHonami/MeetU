import { API_BASE } from "./config";

export type AuthTokens = { accessToken: string; expiresIn: number };

let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
let sessionBootstrapped = false;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string): void {
  accessToken = token;
}

export function clearAccessToken(): void {
  accessToken = null;
  sessionBootstrapped = false;
}

export function isAuthenticated(): boolean {
  return accessToken !== null;
}

export async function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        clearAccessToken();
        return false;
      }
      const body = (await res.json()) as { tokens: AuthTokens };
      setAccessToken(body.tokens.accessToken);
      return true;
    } catch {
      clearAccessToken();
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/** ページリロード後: HttpOnly Cookie から access token を再取得 */
export async function ensureSession(): Promise<boolean> {
  if (accessToken) return true;
  if (sessionBootstrapped) return false;
  sessionBootstrapped = true;
  return refreshSession();
}

function isAuthEndpoint(url: string): boolean {
  return url.includes("/api/auth/");
}

export const authenticatedFetch: typeof fetch = async (input, init) => {
  const execute = async (retried: boolean): Promise<Response> => {
    const headers = new Headers(init?.headers);
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const res = await fetch(input, { ...init, headers, credentials: "include" });

    if (res.status === 401 && !retried) {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
      if (!isAuthEndpoint(url)) {
        const ok = await refreshSession();
        if (ok) return execute(true);
        clearAccessToken();
      }
    }
    return res;
  };

  return execute(false);
};
