import { authenticatedFetch, client, unwrap } from "../../shared/api";
import type { Match } from "../../entities/match/model";
import type { Message } from "../../entities/message/model";
import type { Owner } from "../../entities/user/model";
import type { GeoPoint } from "../../entities/user/geo";

export const matchApi = {
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
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    return unwrap<{ message: Message; notified: boolean }>({
      ok: res.ok,
      status: res.status,
      json: () => res.json(),
    });
  },
};
