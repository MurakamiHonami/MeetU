import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// auth.ts はモジュールスコープに状態を持つため、テストごとに読み直す
async function loadAuth() {
  vi.resetModules();
  return import("./auth");
}

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

const tokens = (accessToken: string) => ({ tokens: { accessToken, expiresIn: 900 } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("access token state", () => {
  it("starts unauthenticated", async () => {
    const auth = await loadAuth();
    expect(auth.getAccessToken()).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
  });

  it("stores and reports a token", async () => {
    const auth = await loadAuth();
    auth.setAccessToken("tok-1");
    expect(auth.getAccessToken()).toBe("tok-1");
    expect(auth.isAuthenticated()).toBe(true);
  });

  it("clears the token", async () => {
    const auth = await loadAuth();
    auth.setAccessToken("tok-1");
    auth.clearAccessToken();
    expect(auth.getAccessToken()).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
  });
});

describe("refreshSession", () => {
  it("stores the new token and returns true on success", async () => {
    const auth = await loadAuth();
    fetchMock.mockResolvedValue(jsonResponse(tokens("fresh")));

    await expect(auth.refreshSession()).resolves.toBe(true);
    expect(auth.getAccessToken()).toBe("fresh");
  });

  it("POSTs to the refresh endpoint with credentials included", async () => {
    const auth = await loadAuth();
    fetchMock.mockResolvedValue(jsonResponse(tokens("fresh")));

    await auth.refreshSession();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/auth/refresh");
    expect(init).toMatchObject({ method: "POST", credentials: "include" });
  });

  it("clears the token and returns false when the server rejects", async () => {
    const auth = await loadAuth();
    auth.setAccessToken("stale");
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 401 }));

    await expect(auth.refreshSession()).resolves.toBe(false);
    expect(auth.getAccessToken()).toBeNull();
  });

  it("clears the token and returns false when fetch throws", async () => {
    const auth = await loadAuth();
    auth.setAccessToken("stale");
    fetchMock.mockRejectedValue(new Error("offline"));

    await expect(auth.refreshSession()).resolves.toBe(false);
    expect(auth.getAccessToken()).toBeNull();
  });

  it("de-duplicates concurrent refreshes into a single request", async () => {
    const auth = await loadAuth();
    let release!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => (release = resolve)));

    const a = auth.refreshSession();
    const b = auth.refreshSession();
    release(jsonResponse(tokens("fresh")));

    expect(await Promise.all([a, b])).toEqual([true, true]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("allows a new request once the in-flight refresh settles", async () => {
    const auth = await loadAuth();
    fetchMock.mockResolvedValue(jsonResponse(tokens("fresh")));

    await auth.refreshSession();
    await auth.refreshSession();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("ensureSession", () => {
  it("returns true without a request when a token is already held", async () => {
    const auth = await loadAuth();
    auth.setAccessToken("tok-1");

    await expect(auth.ensureSession()).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bootstraps from the refresh cookie when no token is held", async () => {
    const auth = await loadAuth();
    fetchMock.mockResolvedValue(jsonResponse(tokens("from-cookie")));

    await expect(auth.ensureSession()).resolves.toBe(true);
    expect(auth.getAccessToken()).toBe("from-cookie");
  });

  it("skips the bootstrap on a second call once one has completed without clearing", async () => {
    const auth = await loadAuth();
    // refresh が成功 → その後トークンだけ手動で捨てても、再ブートストラップはしない
    fetchMock.mockResolvedValue(jsonResponse(tokens("from-cookie")));
    await expect(auth.ensureSession()).resolves.toBe(true);

    auth.setAccessToken("");
    // 空文字は falsy なので accessToken の早期 return は通らない
    await expect(auth.ensureSession()).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("re-bootstraps after a failed bootstrap, because the failure clears the flag", async () => {
    // 現状の挙動: refresh 失敗 → clearAccessToken() が sessionBootstrapped を戻すため
    // 「一度きり」ガードは失敗時には効かない。
    const auth = await loadAuth();
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 401 }));

    await expect(auth.ensureSession()).resolves.toBe(false);
    await expect(auth.ensureSession()).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("bootstraps again after the token is cleared", async () => {
    const auth = await loadAuth();
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 401 }));

    await auth.ensureSession();
    auth.clearAccessToken();
    await auth.ensureSession();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("authenticatedFetch", () => {
  it("sends the Authorization header when a token is held", async () => {
    const auth = await loadAuth();
    auth.setAccessToken("tok-1");
    fetchMock.mockResolvedValue(jsonResponse({}));

    await auth.authenticatedFetch("/api/cards");

    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer tok-1");
    expect(init.credentials).toBe("include");
  });

  it("omits the Authorization header when no token is held", async () => {
    const auth = await loadAuth();
    fetchMock.mockResolvedValue(jsonResponse({}));

    await auth.authenticatedFetch("/api/cards");

    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init.headers).get("Authorization")).toBeNull();
  });

  it("preserves caller-supplied headers and method", async () => {
    const auth = await loadAuth();
    fetchMock.mockResolvedValue(jsonResponse({}));

    await auth.authenticatedFetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
  });

  it("returns a successful response untouched", async () => {
    const auth = await loadAuth();
    const ok = jsonResponse({ cards: [] });
    fetchMock.mockResolvedValue(ok);

    expect(await auth.authenticatedFetch("/api/cards")).toBe(ok);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes and retries once on 401, using the new token", async () => {
    const auth = await loadAuth();
    auth.setAccessToken("stale");
    const retried = jsonResponse({ cards: [] });
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 401 }))
      .mockResolvedValueOnce(jsonResponse(tokens("fresh")))
      .mockResolvedValueOnce(retried);

    expect(await auth.authenticatedFetch("/api/cards")).toBe(retried);
    expect(new Headers(fetchMock.mock.calls[2][1].headers).get("Authorization")).toBe(
      "Bearer fresh",
    );
  });

  it("does not retry a second time when the retry also 401s", async () => {
    const auth = await loadAuth();
    auth.setAccessToken("stale");
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 401 }))
      .mockResolvedValueOnce(jsonResponse(tokens("fresh")))
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 401 }));

    const res = await auth.authenticatedFetch("/api/cards");
    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("clears the token and returns the 401 when the refresh fails", async () => {
    const auth = await loadAuth();
    auth.setAccessToken("stale");
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 401 }))
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 401 }));

    const res = await auth.authenticatedFetch("/api/cards");
    expect(res.status).toBe(401);
    expect(auth.getAccessToken()).toBeNull();
  });

  it("does not attempt a refresh when an auth endpoint returns 401", async () => {
    const auth = await loadAuth();
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 401 }));

    const res = await auth.authenticatedFetch("/api/auth/login");
    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("resolves the URL from a Request input when deciding to refresh", async () => {
    const auth = await loadAuth();
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 401 }));

    await auth.authenticatedFetch(new Request("http://localhost/api/auth/refresh"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("resolves the URL from a URL input when deciding to refresh", async () => {
    const auth = await loadAuth();
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 401 }));

    await auth.authenticatedFetch(new URL("http://localhost/api/auth/login"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not refresh on a non-401 error status", async () => {
    const auth = await loadAuth();
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 500 }));

    const res = await auth.authenticatedFetch("/api/cards");
    expect(res.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
