import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
const putToStorage = vi.fn();

vi.mock("../../shared/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../shared/api")>();
  return {
    ...actual,
    putToStorage: (...a: unknown[]) => putToStorage(...a),
    client: { api: { uploads: { $post: (...a: unknown[]) => post(...a) } } },
  };
});

import { uploadApi } from "./api";

const ok = (body: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve(body) });
const fail = (status: number, body: unknown) => ({
  ok: false,
  status,
  json: () => Promise.resolve(body),
});

const ticket = {
  uploadUrl: "https://storage.example/put",
  imageKey: "img/1.jpg",
  contentType: "image/jpeg",
};

function file(size = 1234, type = "image/jpeg") {
  const f = new File(["x"], "photo.jpg", { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  putToStorage.mockResolvedValue(undefined);
});

describe("uploadImage", () => {
  it("requests a ticket with the thread, content type and size", async () => {
    post.mockResolvedValue(ok(ticket));

    await uploadApi.uploadImage({ matchId: "m1" }, file(4242, "image/png"));

    expect(post).toHaveBeenCalledWith({
      json: { matchId: "m1", contentType: "image/png", size: 4242 },
    });
  });

  it("supports a group thread as well as a match thread", async () => {
    post.mockResolvedValue(ok(ticket));

    await uploadApi.uploadImage({ groupId: "g1" }, file());

    expect(post.mock.calls[0][0].json.groupId).toBe("g1");
  });

  it("PUTs the file to the signed URL from the ticket", async () => {
    post.mockResolvedValue(ok(ticket));
    const f = file();

    await uploadApi.uploadImage({ matchId: "m1" }, f);

    expect(putToStorage).toHaveBeenCalledWith("https://storage.example/put", f);
  });

  it("returns the image key for the caller to send in a message", async () => {
    post.mockResolvedValue(ok(ticket));

    await expect(uploadApi.uploadImage({ matchId: "m1" }, file())).resolves.toBe("img/1.jpg");
  });

  it("does not upload when the ticket request is rejected", async () => {
    post.mockResolvedValue(fail(413, { message: "画像が大きすぎます" }));

    await expect(uploadApi.uploadImage({ matchId: "m1" }, file())).rejects.toThrow(
      "画像が大きすぎます",
    );
    expect(putToStorage).not.toHaveBeenCalled();
  });

  it("propagates a storage upload failure", async () => {
    post.mockResolvedValue(ok(ticket));
    putToStorage.mockRejectedValue(new Error("送信できませんでした"));

    await expect(uploadApi.uploadImage({ matchId: "m1" }, file())).rejects.toThrow(
      "送信できませんでした",
    );
  });
});
