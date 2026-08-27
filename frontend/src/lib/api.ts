import liff from "@line/liff";

const BASE = import.meta.env.VITE_API_BASE as string;

export type CardType = "GIVE" | "WANT" | "COMPANION";

export const TYPE_LABEL: Record<CardType, string> = {
  GIVE: "【譲】",
  WANT: "【求】",
  COMPANION: "【同行者求】",
};

export type Tag = { tagId: string; name: string; category?: string; useCount?: number };

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

export type GeoPoint = { lat: number; lon: number; name?: string };

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
  /** おすすめ順で返るときだけ付く */
  score?: number;
  reasonTags?: string[];
  /** 地図検索のときだけ付く */
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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  // ID Token はリクエストごとに取り直す。期限切れならログインし直す
  const token = liff.getIDToken();
  if (!token) {
    liff.login({ redirectUri: window.location.href });
    throw new ApiError(401, "ログインが必要です");
  }

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(res.status, data.message ?? "通信に失敗しました", data.code ?? data.error);
  }
  return data as T;
}

/**
 * S3 への直接アップロード。
 *
 * fetch ではなく XMLHttpRequest を使う。LINE アプリ内の WebView では
 * fetch + File body が理由の分からない "Load failed" で落ちることがあり、
 * XHR の方が確実で、失敗の種類（通信断・タイムアウト・S3 のエラー）も見分けられる。
 * 署名付き URL なので Authorization も Content-Type も付けない。
 */
function putToS3(url: string, file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.timeout = 60000;

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      // S3 は失敗理由を XML で返す
      const code = /<Code>([^<]+)<\/Code>/.exec(xhr.responseText || "")?.[1];
      reject(
        new ApiError(
          xhr.status,
          code
            ? `画像を送れませんでした（${code}）`
            : `画像を送れませんでした（HTTP ${xhr.status}）`,
        ),
      );
    };

    xhr.onerror = () =>
      reject(new ApiError(0, "画像の送信先に接続できませんでした。通信環境をご確認ください。"));
    xhr.ontimeout = () =>
      reject(new ApiError(0, "画像の送信がタイムアウトしました。もう一度お試しください。"));
    xhr.onabort = () => reject(new ApiError(0, "画像の送信が中断されました。"));

    xhr.send(file);
  });
}

const get = <T,>(path: string) => request<T>(path);
const post = <T,>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });
const del = <T,>(path: string) => request<T>(path, { method: "DELETE" });

export const api = {
  me: () => get<{ user: Owner & { cardCount: number } }>("/me"),
  myReviews: () =>
    get<{ reviews: { rating: number; comment?: string; createdAt: string }[] }>("/me/reviews"),

  suggestTags: (q: string) =>
    get<{ tags: Tag[]; createCandidate?: Tag & { isNew: boolean } }>(
      `/tags?q=${encodeURIComponent(q)}`,
    ),

  createCard: (payload: {
    type: CardType;
    title: string;
    note?: string;
    tags: { name: string; category?: string }[];
    requiredTags?: { name: string }[];
    minMatchCount: number;
    dates?: string[];
    location?: GeoPoint | null;
  }) =>
    post<{
      card: Card;
      newMatches: { matchId: string; matchCount: number; matchedTags: string[]; card: Card }[];
      newGroups: Group[];
    }>("/cards", payload),

  myCards: () => get<{ cards: Card[] }>("/cards/mine"),
  card: (cardId: string) => get<{ card: Card }>(`/cards/${cardId}`),
  closeCard: (cardId: string) => del<{ card: Card }>(`/cards/${cardId}`),
  cardMatches: (cardId: string) =>
    get<{ cards: Card[]; minMatchCount: number }>(`/cards/${cardId}/matches`),

  search: (params: { tags: string[]; type?: CardType | ""; minMatch: number }) => {
    const query = new URLSearchParams({
      tags: params.tags.join(","),
      minMatch: String(params.minMatch),
    });
    if (params.type) query.set("type", params.type);
    return get<{ cards: Card[] }>(`/cards?${query.toString()}`);
  },

  matches: () => get<{ matches: Match[] }>("/matches"),
  match: (matchId: string) => get<{ match: Match }>(`/matches/${matchId}`),
  accept: (matchId: string) =>
    post<{ match: Match; bothAccepted: boolean }>(`/matches/${matchId}/accept`),
  decline: (matchId: string) => post<{ match: Match }>(`/matches/${matchId}/decline`),
  complete: (matchId: string) => post<{ match: Match }>(`/matches/${matchId}/complete`),

  messages: (matchId: string, after?: string) => {
    const query = after ? `?after=${encodeURIComponent(after)}` : "";
    return get<{
      messages: Message[];
      canSend: boolean;
      status: string;
      partner: Owner | null;
    }>(`/matches/${matchId}/messages${query}`);
  },
  sendMessage: (
    matchId: string,
    payload: { text?: string; imageKey?: string; location?: GeoPoint },
  ) => post<{ message: Message; notified: boolean }>(`/matches/${matchId}/messages`, payload),

  /** 署名付き URL を取って、S3 へ直接アップロードする */
  uploadImage: async (thread: { matchId?: string; groupId?: string }, file: File) => {
    const ticket = await post<{
      uploadUrl: string;
      imageKey: string;
      contentType: string;
    }>("/uploads", { ...thread, contentType: file.type, size: file.size });

    await putToS3(ticket.uploadUrl, file);
    return ticket.imageKey;
  },

  feed: () =>
    get<{ cards: Card[]; hasFavorites: boolean }>("/feed"),
  saveCard: (cardId: string) => post<{ cardId: string }>(`/feed/${cardId}/save`),
  skipCard: (cardId: string) => post<{ cardId: string }>(`/feed/${cardId}/skip`),
  savedCards: () => get<{ cards: Card[] }>("/saved"),
  unsaveCard: (cardId: string) => del<{ cardId: string }>(`/saved/${cardId}`),

  nearby: (params: { lat: number; lon: number; radius: number; type?: CardType | "" }) => {
    const query = new URLSearchParams({
      lat: String(params.lat),
      lon: String(params.lon),
      radius: String(params.radius),
    });
    if (params.type) query.set("type", params.type);
    return get<{
      cards: Card[];
      center: { lat: number; lon: number };
      radiusKm: number;
    }>(`/nearby?${query.toString()}`);
  },

  updateFavorites: (favorites: { name: string }[]) =>
    request<{ user: Owner }>("/me", { method: "PUT", body: JSON.stringify({ favorites }) }),

  /** 拠点。カードに位置を付けなくても近い相手を優先できる */
  updateHome: (homeLocation: GeoPoint | null) =>
    request<{ user: Owner }>("/me", {
      method: "PUT",
      body: JSON.stringify({ homeLocation }),
    }),

  groups: () => get<{ groups: Group[] }>("/groups"),
  group: (groupId: string) => get<{ group: Group }>(`/groups/${groupId}`),
  acceptGroup: (groupId: string) =>
    post<{ group: Group; established: boolean }>(`/groups/${groupId}/accept`),
  declineGroup: (groupId: string) => post<{ group: Group }>(`/groups/${groupId}/decline`),
  completeGroup: (groupId: string) => post<{ group: Group }>(`/groups/${groupId}/complete`),

  groupMessages: (groupId: string, after?: string) => {
    const query = after ? `?after=${encodeURIComponent(after)}` : "";
    return get<{
      messages: (Message & { sender: Owner })[];
      canSend: boolean;
      status: string;
      members: Owner[];
    }>(`/groups/${groupId}/messages${query}`);
  },
  sendGroupMessage: (
    groupId: string,
    payload: { text?: string; imageKey?: string; location?: GeoPoint },
  ) => post<{ message: Message }>(`/groups/${groupId}/messages`, payload),

  review: (payload: { matchId: string; rating: number; comment?: string }) =>
    post<{ review: unknown }>("/reviews", payload),
  report: (payload: {
    targetUserId: string;
    matchId?: string;
    reason: string;
    detail?: string;
  }) => post<{ reportId: string; message: string }>("/reports", payload),
};
