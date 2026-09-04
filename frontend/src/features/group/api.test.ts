import { beforeEach, describe, expect, it, vi } from "vitest";

const call = vi.fn();
const url = vi.fn();
const authenticatedFetch = vi.fn();

vi.mock("../../shared/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../shared/api")>();
  return {
    ...actual,
    authenticatedFetch: (...a: unknown[]) => authenticatedFetch(...a),
    client: {
      api: {
        groups: {
          $get: (...a: unknown[]) => call("groups.get", ...a),
          ":id": {
            $get: (...a: unknown[]) => call("group.get", ...a),
            accept: { $post: (...a: unknown[]) => call("accept", ...a) },
            decline: { $post: (...a: unknown[]) => call("decline", ...a) },
            complete: { $post: (...a: unknown[]) => call("complete", ...a) },
            messages: { $url: (...a: unknown[]) => url(...a) },
          },
        },
      },
    },
  };
});

import { groupApi } from "./api";

const ok = (body: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });
const fail = (status: number, body: unknown) => ({
  ok: false,
  status,
  json: () => Promise.resolve(body),
});

beforeEach(() => {
  vi.clearAllMocks();
  url.mockReturnValue("http://localhost/api/groups/g1/messages");
});

describe("group lifecycle", () => {
  it("lists my groups", async () => {
    call.mockResolvedValue(ok({ groups: [{ groupId: "g1" }] }));

    await expect(groupApi.groups()).resolves.toEqual({ groups: [{ groupId: "g1" }] });
    expect(call).toHaveBeenCalledWith("groups.get");
  });

  it("fetches a single group", async () => {
    call.mockResolvedValue(ok({ group: { groupId: "g1" } }));

    await groupApi.group("g1");
    expect(call).toHaveBeenCalledWith("group.get", { param: { id: "g1" } });
  });

  it("accepts a group and reports whether the cycle is established", async () => {
    call.mockResolvedValue(ok({ group: { groupId: "g1" }, established: true }));

    const res = await groupApi.acceptGroup("g1");
    expect(res.established).toBe(true);
    expect(call).toHaveBeenCalledWith("accept", { param: { id: "g1" } });
  });

  it("reports a group that is not yet established", async () => {
    call.mockResolvedValue(ok({ group: { groupId: "g1" }, established: false }));

    expect((await groupApi.acceptGroup("g1")).established).toBe(false);
  });

  it("declines a group", async () => {
    call.mockResolvedValue(ok({ group: { groupId: "g1", status: "DECLINED" } }));

    await groupApi.declineGroup("g1");
    expect(call).toHaveBeenCalledWith("decline", { param: { id: "g1" } });
  });

  it("completes a group", async () => {
    call.mockResolvedValue(ok({ group: { groupId: "g1", status: "COMPLETED" } }));

    await groupApi.completeGroup("g1");
    expect(call).toHaveBeenCalledWith("complete", { param: { id: "g1" } });
  });

  it("throws when the group is gone", async () => {
    call.mockResolvedValue(fail(404, { message: "グループが見つかりません" }));

    await expect(groupApi.group("gone")).rejects.toThrow("グループが見つかりません");
  });
});

describe("groupMessages", () => {
  it("builds the URL without a query when no cursor is given", async () => {
    authenticatedFetch.mockResolvedValue(ok({ messages: [], canSend: true, members: [] }));

    await groupApi.groupMessages("g1");

    expect(url).toHaveBeenCalledWith({ param: { id: "g1" } });
  });

  it("includes the after cursor when given", async () => {
    authenticatedFetch.mockResolvedValue(ok({ messages: [], canSend: true, members: [] }));

    await groupApi.groupMessages("g1", "2026-01-01T00:00:00Z");

    expect(url).toHaveBeenCalledWith({
      param: { id: "g1" },
      query: { after: "2026-01-01T00:00:00Z" },
    });
  });

  it("returns the thread with its members", async () => {
    const body = {
      messages: [{ messageId: "x1", text: "はじめまして", sender: { userId: "u2" } }],
      canSend: true,
      status: "ESTABLISHED",
      members: [{ userId: "u1" }, { userId: "u2" }],
    };
    authenticatedFetch.mockResolvedValue(ok(body));

    await expect(groupApi.groupMessages("g1")).resolves.toEqual(body);
  });

  it("throws when the thread is not readable", async () => {
    authenticatedFetch.mockResolvedValue(fail(403, { message: "閲覧できません" }));

    await expect(groupApi.groupMessages("g1")).rejects.toThrow("閲覧できません");
  });
});

describe("sendGroupMessage", () => {
  it("POSTs a text message as JSON", async () => {
    authenticatedFetch.mockResolvedValue(ok({ message: { messageId: "x1" } }));

    await groupApi.sendGroupMessage("g1", { text: "よろしくお願いします" });

    const [, init] = authenticatedFetch.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({ text: "よろしくお願いします" });
  });

  it("builds the POST URL without a cursor query", async () => {
    authenticatedFetch.mockResolvedValue(ok({ message: {} }));

    await groupApi.sendGroupMessage("g1", { text: "hi" });

    expect(url).toHaveBeenCalledWith({ param: { id: "g1" } });
  });

  it("POSTs an image key", async () => {
    authenticatedFetch.mockResolvedValue(ok({ message: {} }));

    await groupApi.sendGroupMessage("g1", { imageKey: "img/1.jpg" });

    expect(JSON.parse(authenticatedFetch.mock.calls[0][1].body)).toEqual({
      imageKey: "img/1.jpg",
    });
  });

  it("POSTs a location", async () => {
    authenticatedFetch.mockResolvedValue(ok({ message: {} }));
    const location = { lat: 35.68, lon: 139.76 };

    await groupApi.sendGroupMessage("g1", { location });

    expect(JSON.parse(authenticatedFetch.mock.calls[0][1].body)).toEqual({ location });
  });

  it("throws when sending is not allowed", async () => {
    authenticatedFetch.mockResolvedValue(fail(403, { message: "送信できません" }));

    await expect(groupApi.sendGroupMessage("g1", { text: "hi" })).rejects.toThrow("送信できません");
  });
});
