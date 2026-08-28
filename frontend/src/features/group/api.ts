import { authenticatedFetch, client, unwrap } from "../../shared/api";
import type { Group } from "../../entities/group/model";
import type { Message } from "../../entities/message/model";
import type { Owner } from "../../entities/user/model";
import type { GeoPoint } from "../../entities/user/geo";

export const groupApi = {
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
};
