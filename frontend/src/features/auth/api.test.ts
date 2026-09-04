import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../shared/api";

const post = vi.fn();
const setAccessToken = vi.fn();
const clearAccessToken = vi.fn();

vi.mock("../../shared/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../shared/api")>();
  return {
    ...actual,
    setAccessToken: (...a: unknown[]) => setAccessToken(...a),
    clearAccessToken: (...a: unknown[]) => clearAccessToken(...a),
    client: {
      api: {
        auth: {
          signup: { $post: (...a: unknown[]) => post("signup", ...a) },
          login: { $post: (...a: unknown[]) => post("login", ...a) },
          logout: { $post: (...a: unknown[]) => post("logout", ...a) },
        },
      },
    },
  };
});

import { login, logout, signOut, signup } from "./api";

const ok = (body: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });
const fail = (status: number, body: unknown) => ({
  ok: false,
  status,
  json: () => Promise.resolve(body),
});

const session = {
  user: { id: "u1", email: "a@example.com", displayName: "あきら" },
  tokens: { accessToken: "tok-1", expiresIn: 900 },
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe("signup", () => {
  const input = { email: "a@example.com", password: "pw", displayName: "あきら" };

  it("posts the signup payload as JSON", async () => {
    post.mockResolvedValue(ok(session));
    await signup(input);
    expect(post).toHaveBeenCalledWith("signup", { json: input });
  });

  it("returns the created user and stores the access token", async () => {
    post.mockResolvedValue(ok(session));

    await expect(signup(input)).resolves.toEqual(session);
    expect(setAccessToken).toHaveBeenCalledWith("tok-1");
  });

  it("throws and stores no token when the server rejects", async () => {
    post.mockResolvedValue(fail(409, { message: "既に登録されています" }));

    await expect(signup(input)).rejects.toThrow("既に登録されています");
    expect(setAccessToken).not.toHaveBeenCalled();
  });
});

describe("login", () => {
  const input = { email: "a@example.com", password: "pw" };

  it("posts the credentials and stores the access token", async () => {
    post.mockResolvedValue(ok(session));

    await expect(login(input)).resolves.toEqual(session);
    expect(post).toHaveBeenCalledWith("login", { json: input });
    expect(setAccessToken).toHaveBeenCalledWith("tok-1");
  });

  it("surfaces an ApiError with the server status on bad credentials", async () => {
    post.mockResolvedValue(fail(401, { message: "認証に失敗しました" }));

    const err = await login(input).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(setAccessToken).not.toHaveBeenCalled();
  });
});

describe("logout", () => {
  it("posts to the logout endpoint and returns the result", async () => {
    post.mockResolvedValue(ok({ success: true }));

    await expect(logout()).resolves.toEqual({ success: true });
    expect(post).toHaveBeenCalledWith("logout", {});
  });

  it("throws when the server rejects", async () => {
    post.mockResolvedValue(fail(500, { message: "失敗" }));
    await expect(logout()).rejects.toThrow("失敗");
  });
});

describe("signOut", () => {
  it("clears the local token after a successful logout", async () => {
    post.mockResolvedValue(ok({ success: true }));

    await expect(signOut()).resolves.toBeUndefined();
    expect(clearAccessToken).toHaveBeenCalledOnce();
  });

  it("still clears the local token when the server logout fails", async () => {
    post.mockResolvedValue(fail(500, { message: "サーバーエラー" }));

    await expect(signOut()).resolves.toBeUndefined();
    expect(clearAccessToken).toHaveBeenCalledOnce();
  });

  it("still clears the local token when the request throws", async () => {
    post.mockRejectedValue(new Error("offline"));

    await expect(signOut()).resolves.toBeUndefined();
    expect(clearAccessToken).toHaveBeenCalledOnce();
  });
});
