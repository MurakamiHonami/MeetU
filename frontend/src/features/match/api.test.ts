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
        matches: {
          $get: (...a: unknown[]) => call("matches.get", ...a),
          ":id": {
            $get: (...a: unknown[]) => call("match.get", ...a),
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

import { matchApi } from "./api";

const ok = (body: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });
const fail = (status: number, body: unknown) => ({
  ok: false,
  status,
  json: () => Promise.resolve(body),
});

beforeEach(() => {
  vi.clearAllMocks();
  url.mockReturnValue("http://localhost/api/matches/m1/messages");
});

describe("match lifecycle", () => {
  it("lists my matches", async () => {
    call.mockResolvedValue(ok({ matches: [{ matchId: "m1" }] }));

    await expect(matchApi.matches()).resolves.toEqual({ matches: [{ matchId: "m1" }] });
    expect(call).toHaveBeenCalledWith("matches.get");
  });

  it("fetches a single match", async () => {
    call.mockResolvedValue(ok({ match: { matchId: "m1" } }));

    await matchApi.match("m1");
    expect(call).toHaveBeenCalledWith("match.get", { param: { id: "m1" } });
  });

  it("accepts a match and reports whether both sides accepted", async () => {
    call.mockResolvedValue(ok({ match: { matchId: "m1" }, bothAccepted: true }));

    const res = await matchApi.accept("m1");
    expect(res.bothAccepted).toBe(true);
    expect(call).toHaveBeenCalledWith("accept", { param: { id: "m1" } });
  });

  it("declines a match", async () => {
    call.mockResolvedValue(ok({ match: { matchId: "m1", status: "DECLINED" } }));

    await matchApi.decline("m1");
    expect(call).toHaveBeenCalledWith("decline", { param: { id: "m1" } });
  });

  it("completes a match", async () => {
    call.mockResolvedValue(ok({ match: { matchId: "m1", status: "COMPLETED" } }));

    await matchApi.complete("m1");
    expect(call).toHaveBeenCalledWith("complete", { param: { id: "m1" } });
  });

  it("throws when accepting a match that is no longer open", async () => {
    call.mockResolvedValue(fail(409, { message: "このマッチは終了しています" }));

    await expect(matchApi.accept("m1")).rejects.toThrow("このマッチは終了しています");
  });
});

describe("messages", () => {
  it("builds the URL without a query when no cursor is given", async () => {
    authenticatedFetch.mockResolvedValue(ok({ messages: [], canSend: true }));

    await matchApi.messages("m1");

    expect(url).toHaveBeenCalledWith({ param: { id: "m1" } });
  });

  it("includes the after cursor in the URL query when given", async () => {
    authenticatedFetch.mockResolvedValue(ok({ messages: [], canSend: true }));

    await matchApi.messages("m1", "2026-01-01T00:00:00Z");

    expect(url).toHaveBeenCalledWith({
      param: { id: "m1" },
      query: { after: "2026-01-01T00:00:00Z" },
    });
  });

  it("treats an empty cursor as absent", async () => {
    authenticatedFetch.mockResolvedValue(ok({ messages: [], canSend: true }));

    await matchApi.messages("m1", "");

    expect(url).toHaveBeenCalledWith({ param: { id: "m1" } });
  });

  it("returns the thread with its send permission and partner", async () => {
    const body = {
      messages: [{ messageId: "x1", text: "こんにちは" }],
      canSend: true,
      status: "ACCEPTED",
      partner: { userId: "u2" },
    };
    authenticatedFetch.mockResolvedValue(ok(body));

    await expect(matchApi.messages("m1")).resolves.toEqual(body);
  });

  it("throws when the thread is not readable", async () => {
    authenticatedFetch.mockResolvedValue(fail(403, { message: "閲覧できません" }));

    await expect(matchApi.messages("m1")).rejects.toThrow("閲覧できません");
  });
});

describe("sendMessage", () => {
  it("POSTs a text message as JSON", async () => {
    authenticatedFetch.mockResolvedValue(ok({ message: { messageId: "x1" }, notified: true }));

    await matchApi.sendMessage("m1", { text: "よろしくお願いします" });

    const [, init] = authenticatedFetch.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({ text: "よろしくお願いします" });
  });

  it("POSTs an image key", async () => {
    authenticatedFetch.mockResolvedValue(ok({ message: {}, notified: false }));

    await matchApi.sendMessage("m1", { imageKey: "img/1.jpg" });

    expect(JSON.parse(authenticatedFetch.mock.calls[0][1].body)).toEqual({
      imageKey: "img/1.jpg",
    });
  });

  it("POSTs a location", async () => {
    authenticatedFetch.mockResolvedValue(ok({ message: {}, notified: false }));
    const location = { lat: 35.68, lon: 139.76 };

    await matchApi.sendMessage("m1", { location });

    expect(JSON.parse(authenticatedFetch.mock.calls[0][1].body)).toEqual({ location });
  });

  it("returns the created message and the notified flag", async () => {
    authenticatedFetch.mockResolvedValue(ok({ message: { messageId: "x1" }, notified: true }));

    await expect(matchApi.sendMessage("m1", { text: "hi" })).resolves.toEqual({
      message: { messageId: "x1" },
      notified: true,
    });
  });

  it("throws when sending is not allowed", async () => {
    authenticatedFetch.mockResolvedValue(fail(403, { message: "送信できません" }));

    await expect(matchApi.sendMessage("m1", { text: "hi" })).rejects.toThrow("送信できません");
  });
});
