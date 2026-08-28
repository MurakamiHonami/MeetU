import { hc } from "hono/client";
import type { AppType } from "../../../backend/src/index";

/** 空 = 同一オリジン（Vite プロキシ）。staging/production は .env で API URL を指定 */
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export type AuthTokens = { accessToken: string; expiresIn: number };

// access token はメモリのみ（XSS で窃取されにくくする）
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

async function refreshSession(): Promise<boolean> {
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

const authenticatedFetch: typeof fetch = async (input, init) => {
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

export const client = hc<AppType>(API_BASE, { fetch: authenticatedFetch });

// ---------------- 共有型（ページが参照する契約） ----------------

export type CardType = "GIVE" | "WANT" | "COMPANION";

export const TYPE_LABEL: Record<CardType, string> = {
  GIVE: "【譲】",
  WANT: "【求】",
  COMPANION: "【同行者求】",
};

export type Tag = { tagId: string; name: string; category?: string; useCount?: number };
export type GeoPoint = { lat: number; lon: number; name?: string };

export type Owner = {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  ratingAvg: number | null;
  ratingCount: number;
  tradeCount: number;
  isNew: boolean;
  favorites?: Tag[];
  homeLocation?: GeoPoint | null;
};

export type Card = {
  cardId: string;
  type: CardType;
  title: string;
  note?: string;
  tags: Tag[];
  requiredTags: string[];
  minMatchCount: number;
  dates?: string[];
  location?: GeoPoint;
  status: string;
  createdAt: string;
  owner?: Owner;
  matchedTags?: string[];
  matchCount?: number;
  score?: number;
  reasonTags?: string[];
  distanceKm?: number;
  distanceLabel?: string;
};

export type Match = {
  matchId: string;
  status: string;
  statusLabel: string;
  matchCount: number;
  matchedTags: string[];
  createdAt: string;
  acceptedByMe: boolean;
  acceptedByPartner: boolean;
  distanceLabel?: string;
  canChat: boolean;
  hasUnread: boolean;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  partner: Owner | null;
  partnerCard: Card | null;
  myCard: Card | null;
  iGive: Card | null;
  iReceive: Card | null;
};

export type Message = {
  messageId: string;
  text: string;
  createdAt: string;
  mine: boolean;
  kind: "text" | "image" | "location";
  imageUrl?: string;
  location?: GeoPoint;
};

export type GroupStep = {
  from: Owner;
  to: Owner;
  card: Card | null;
  matchedTags: string[];
  isMine: boolean;
};

export type Group = {
  groupId: string;
  length: number;
  status: string;
  statusLabel: string;
  createdAt: string;
  steps: GroupStep[];
  members: Owner[];
  myAnswer?: "accept" | "decline";
  acceptedCount: number;
  iGive: Card | null;
  iGiveTo: Owner | null;
  iReceive: Card | null;
  iReceiveFrom: Owner | null;
  canChat: boolean;
  lastMessagePreview?: string;
  hasUnread: boolean;
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

async function unwrap<T>(res: { ok: boolean; status: number; json(): Promise<unknown> }): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as { message?: string; error?: string }).message
      ?? (body as { error?: string }).error
      ?? `リクエストに失敗しました (${res.status})`;
    throw new ApiError(res.status, msg, (body as { code?: string }).code);
  }
  return body as T;
}

/** 署名付き URL へ直接 PUT（Authorization ヘッダ不要） */
function putToStorage(url: string, file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.timeout = 60000;
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new ApiError(xhr.status, `画像を送れませんでした（HTTP ${xhr.status}）`));
    };
    xhr.onerror = () => reject(new ApiError(0, "画像の送信先に接続できませんでした"));
    xhr.ontimeout = () => reject(new ApiError(0, "画像の送信がタイムアウトしました"));
    xhr.send(file);
  });
}

// ---------------- 認証 ----------------

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

/** サーバー側 refresh token 失効 + ローカル access token クリア */
export async function signOut(): Promise<void> {
  try {
    await logout();
  } catch {
    // サーバー側失敗でもローカルはクリアする
  } finally {
    clearAccessToken();
  }
}

// ---------------- RPC ラッパー（既存ページ互換の api オブジェクト） ----------------

export const api = {
  me: async () => {
    const res = await client.api.me.$get();
    return unwrap<{ user: Owner & { cardCount: number } }>(res);
  },

  myReviews: async () => {
    const res = await client.api.me.reviews.$get();
    return unwrap<{ reviews: { rating: number; comment?: string; createdAt: string }[] }>(res);
  },

  suggestTags: async (q: string) => {
    const res = await client.api.tags.$get({ query: { q } });
    return unwrap<{ tags: Tag[]; createCandidate?: Tag & { isNew: boolean } }>(res);
  },

  createCard: async (payload: {
    type: CardType;
    title: string;
    note?: string;
    tags: { name: string; category?: string }[];
    requiredTags?: { name: string }[];
    minMatchCount: number;
    dates?: string[];
    location?: GeoPoint | null;
  }) => {
    const res = await client.api.cards.$post({
      json: {
        ...payload,
        tags: payload.tags.map((t) => ({ displayName: t.name, category: t.category })),
        requiredTags: payload.requiredTags?.map((t) => t.name),
      },
    });
    return unwrap<{
      card: Card;
      newMatches: { matchId: string; matchCount: number; matchedTags: string[]; card: Card }[];
      newGroups: Group[];
    }>(res);
  },

  myCards: async () => {
    const res = await client.api.cards.mine.$get();
    return unwrap<{ cards: Card[] }>(res);
  },

  card: async (cardId: string) => {
    const res = await client.api.cards[":id"].$get({ param: { id: cardId } });
    return unwrap<{ card: Card }>(res);
  },

  closeCard: async (cardId: string) => {
    const res = await client.api.cards[":id"].$delete({ param: { id: cardId } });
    return unwrap<{ card: Card }>(res);
  },

  cardMatches: async (cardId: string) => {
    const res = await client.api.cards[":id"].matches.$get({ param: { id: cardId } });
    return unwrap<{ cards: Card[]; minMatchCount: number }>(res);
  },

  search: async (params: { tags: string[]; type?: CardType | ""; minMatch: number }) => {
    const res = await client.api.cards.$get({
      query: {
        tags: params.tags.join(","),
        minMatch: String(params.minMatch),
        ...(params.type ? { type: params.type } : {}),
      },
    });
    return unwrap<{ cards: Card[] }>(res);
  },

  matches: async () => {
    const res = await client.api.matches.$get();
    return unwrap<{ matches: Match[] }>(res);
  },

  match: async (matchId: string) => {
    const res = await client.api.matches[":id"].$get({ param: { id: matchId } });
    return unwrap<{ match: Match }>(res);
  },

  accept: async (matchId: string) => {
    const res = await client.api.matches[":id"].accept.$post({ param: { id: matchId } });
    return unwrap<{ match: Match; bothAccepted: boolean }>(res);
  },

  decline: async (matchId: string) => {
    const res = await client.api.matches[":id"].decline.$post({ param: { id: matchId } });
    return unwrap<{ match: Match }>(res);
  },

  complete: async (matchId: string) => {
    const res = await client.api.matches[":id"].complete.$post({ param: { id: matchId } });
    return unwrap<{ match: Match }>(res);
  },

  messages: async (matchId: string, after?: string) => {
    const url = client.api.matches[":id"].messages.$url({
      param: { id: matchId },
      ...(after ? { query: { after } } : {}),
    });
    const res = await authenticatedFetch(url);
    return unwrap<{
      messages: Message[];
      canSend: boolean;
      status: string;
      partner: Owner | null;
    }>({ ok: res.ok, status: res.status, json: () => res.json() });
  },

  sendMessage: async (
    matchId: string,
    payload: { text?: string; imageKey?: string; location?: GeoPoint },
  ) => {
    const res = await authenticatedFetch(
      client.api.matches[":id"].messages.$url({ param: { id: matchId } }),
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    );
    return unwrap<{ message: Message; notified: boolean }>({
      ok: res.ok,
      status: res.status,
      json: () => res.json(),
    });
  },

  uploadImage: async (thread: { matchId?: string; groupId?: string }, file: File) => {
    const res = await client.api.uploads.$post({
      json: { ...thread, contentType: file.type, size: file.size },
    });
    const ticket = await unwrap<{ uploadUrl: string; imageKey: string; contentType: string }>(res);
    await putToStorage(ticket.uploadUrl, file);
    return ticket.imageKey;
  },

  feed: async () => {
    const res = await client.api.feed.$get();
    return unwrap<{ cards: Card[]; hasFavorites: boolean }>(res);
  },

  saveCard: async (cardId: string) => {
    const res = await client.api.feed[":cardId"].save.$post({ param: { cardId } });
    return unwrap<{ cardId: string }>(res);
  },

  skipCard: async (cardId: string) => {
    const res = await client.api.feed[":cardId"].skip.$post({ param: { cardId } });
    return unwrap<{ cardId: string }>(res);
  },

  savedCards: async () => {
    const res = await client.api.saved.$get();
    return unwrap<{ cards: Card[] }>(res);
  },

  unsaveCard: async (cardId: string) => {
    const res = await client.api.saved[":cardId"].$delete({ param: { cardId } });
    return unwrap<{ cardId: string }>(res);
  },

  nearby: async (params: { lat: number; lon: number; radius: number; type?: CardType | "" }) => {
    const res = await client.api.nearby.$get({
      query: {
        lat: String(params.lat),
        lon: String(params.lon),
        radius: String(params.radius),
        ...(params.type ? { type: params.type } : {}),
      },
    });
    return unwrap<{
      cards: Card[];
      center: { lat: number; lon: number };
      radiusKm: number;
    }>(res);
  },

  updateFavorites: async (favorites: { name: string }[]) => {
    const res = await client.api.me.$put({ json: { favorites } });
    return unwrap<{ user: Owner }>(res);
  },

  updateHome: async (homeLocation: GeoPoint | null) => {
    const res = await client.api.me.$put({ json: { homeLocation } });
    return unwrap<{ user: Owner }>(res);
  },

  groups: async () => {
    const res = await client.api.groups.$get();
    return unwrap<{ groups: Group[] }>(res);
  },

  group: async (groupId: string) => {
    const res = await client.api.groups[":id"].$get({ param: { id: groupId } });
    return unwrap<{ group: Group }>(res);
  },

  acceptGroup: async (groupId: string) => {
    const res = await client.api.groups[":id"].accept.$post({ param: { id: groupId } });
    return unwrap<{ group: Group; established: boolean }>(res);
  },

  declineGroup: async (groupId: string) => {
    const res = await client.api.groups[":id"].decline.$post({ param: { id: groupId } });
    return unwrap<{ group: Group }>(res);
  },

  completeGroup: async (groupId: string) => {
    const res = await client.api.groups[":id"].complete.$post({ param: { id: groupId } });
    return unwrap<{ group: Group }>(res);
  },

  groupMessages: async (groupId: string, after?: string) => {
    const url = client.api.groups[":id"].messages.$url({
      param: { id: groupId },
      ...(after ? { query: { after } } : {}),
    });
    const res = await authenticatedFetch(url);
    return unwrap<{
      messages: (Message & { sender: Owner })[];
      canSend: boolean;
      status: string;
      members: Owner[];
    }>({ ok: res.ok, status: res.status, json: () => res.json() });
  },

  sendGroupMessage: async (
    groupId: string,
    payload: { text?: string; imageKey?: string; location?: GeoPoint },
  ) => {
    const res = await authenticatedFetch(
      client.api.groups[":id"].messages.$url({ param: { id: groupId } }),
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    );
    return unwrap<{ message: Message }>({
      ok: res.ok,
      status: res.status,
      json: () => res.json(),
    });
  },

  review: async (payload: { matchId: string; rating: number; comment?: string }) => {
    const res = await client.api.reviews.$post({ json: payload });
    return unwrap<{ review: unknown }>(res);
  },

  report: async (payload: {
    targetUserId: string;
    matchId?: string;
    reason: string;
    detail?: string;
  }) => {
    const res = await client.api.reports.$post({ json: payload });
    return unwrap<{ reportId: string; message: string }>(res);
  },
};
