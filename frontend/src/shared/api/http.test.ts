import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, putToStorage, unwrap } from "./http";

function resOf(ok: boolean, status: number, body: unknown) {
  return { ok, status, json: () => Promise.resolve(body) };
}

/** promise が reject することを前提に、その ApiError を取り出す */
async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
    throw new Error("expected the promise to reject, but it resolved");
  } catch (e) {
    return e as ApiError;
  }
}

describe("ApiError", () => {
  it("carries status, message and code", () => {
    const err = new ApiError(404, "見つかりません", "NOT_FOUND");
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(404);
    expect(err.message).toBe("見つかりません");
    expect(err.code).toBe("NOT_FOUND");
  });

  it("leaves code undefined when omitted", () => {
    expect(new ApiError(500, "boom").code).toBeUndefined();
  });
});

describe("unwrap", () => {
  it("returns the parsed body when the response is ok", async () => {
    await expect(unwrap<{ cards: number[] }>(resOf(true, 200, { cards: [1, 2] }))).resolves.toEqual(
      {
        cards: [1, 2],
      },
    );
  });

  it("returns an empty object when an ok response has unparsable JSON", async () => {
    const res = { ok: true, status: 204, json: () => Promise.reject(new Error("no body")) };
    await expect(unwrap(res)).resolves.toEqual({});
  });

  it("throws ApiError using the body message", async () => {
    const err = await rejection(unwrap(resOf(false, 400, { message: "入力が不正です" })));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.message).toBe("入力が不正です");
  });

  it("falls back to the body error field when message is absent", async () => {
    const err = await rejection(unwrap(resOf(false, 403, { error: "権限がありません" })));
    expect(err.message).toBe("権限がありません");
  });

  it("prefers message over error when both are present", async () => {
    const err = await rejection(unwrap(resOf(false, 400, { message: "M", error: "E" })));
    expect(err.message).toBe("M");
  });

  it("falls back to a generic message including the status", async () => {
    const err = await rejection(unwrap(resOf(false, 500, {})));
    expect(err.message).toBe("リクエストに失敗しました (500)");
  });

  it("propagates the body code onto the error", async () => {
    const err = await rejection(unwrap(resOf(false, 409, { message: "重複", code: "DUPLICATE" })));
    expect(err.code).toBe("DUPLICATE");
  });

  it("still throws when an error response has unparsable JSON", async () => {
    const res = { ok: false, status: 502, json: () => Promise.reject(new Error("bad gateway")) };
    const err = await rejection(unwrap(res));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("リクエストに失敗しました (502)");
  });
});

class FakeXhr {
  static last: FakeXhr;
  status = 0;
  timeout = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  opened: [string, string, boolean] | null = null;
  sent: unknown = null;

  constructor() {
    FakeXhr.last = this;
  }
  open(method: string, url: string, async: boolean) {
    this.opened = [method, url, async];
  }
  send(body: unknown) {
    this.sent = body;
  }
}

describe("putToStorage", () => {
  const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });

  beforeEach(() => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
  });

  it("PUTs the file to the signed URL", async () => {
    const promise = putToStorage("https://storage.example/put", file);
    const xhr = FakeXhr.last;
    expect(xhr.opened).toEqual(["PUT", "https://storage.example/put", true]);
    expect(xhr.sent).toBe(file);
    expect(xhr.timeout).toBe(60000);

    xhr.status = 200;
    xhr.onload!();
    await expect(promise).resolves.toBeUndefined();
  });

  it("resolves for any 2xx status", async () => {
    const promise = putToStorage("https://storage.example/put", file);
    FakeXhr.last.status = 204;
    FakeXhr.last.onload!();
    await expect(promise).resolves.toBeUndefined();
  });

  it("rejects with the HTTP status for a non-2xx response", async () => {
    const promise = putToStorage("https://storage.example/put", file);
    FakeXhr.last.status = 403;
    FakeXhr.last.onload!();
    const err = await rejection(promise);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(403);
    expect(err.message).toContain("403");
  });

  it("rejects on a network error", async () => {
    const promise = putToStorage("https://storage.example/put", file);
    FakeXhr.last.onerror!();
    const err = await rejection(promise);
    expect(err.status).toBe(0);
    expect(err.message).toBe("画像の送信先に接続できませんでした");
  });

  it("rejects on timeout", async () => {
    const promise = putToStorage("https://storage.example/put", file);
    FakeXhr.last.ontimeout!();
    const err = await rejection(promise);
    expect(err.message).toBe("画像の送信がタイムアウトしました");
  });
});
