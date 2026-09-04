import { afterEach, describe, expect, it, vi } from "vitest";
import { currentPosition, mapLink, shrinkImage } from "./device";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stubGeolocation(impl: unknown) {
  vi.stubGlobal("navigator", { geolocation: impl });
}

describe("currentPosition", () => {
  it("resolves lat/lon from the browser position", async () => {
    stubGeolocation({
      getCurrentPosition: (ok: (p: unknown) => void) =>
        ok({ coords: { latitude: 35.68, longitude: 139.76 } }),
    });

    await expect(currentPosition()).resolves.toEqual({ lat: 35.68, lon: 139.76 });
  });

  it("requests a high-accuracy fix with a timeout", async () => {
    const getCurrentPosition = vi.fn(
      (ok: (p: unknown) => void, _fail?: unknown, _opts?: PositionOptions) =>
        ok({ coords: { latitude: 0, longitude: 0 } }),
    );
    stubGeolocation({ getCurrentPosition });

    await currentPosition();

    expect(getCurrentPosition.mock.calls[0][2]).toEqual({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
    });
  });

  it("rejects when the device has no geolocation support", async () => {
    stubGeolocation(undefined);
    await expect(currentPosition()).rejects.toThrow("この端末では位置情報を取得できません");
  });

  it.each([
    [1, "位置情報の利用が許可されていません。端末の設定を確認してください。"],
    [2, "現在地を取得できませんでした。電波状況を確認してください。"],
    [3, "現在地の取得がタイムアウトしました。"],
  ])("maps geolocation error code %i to a Japanese message", async (code, message) => {
    stubGeolocation({
      getCurrentPosition: (_ok: unknown, fail: (e: unknown) => void) => fail({ code }),
    });

    await expect(currentPosition()).rejects.toThrow(message);
  });

  it("falls back to a generic message for an unknown error code", async () => {
    stubGeolocation({
      getCurrentPosition: (_ok: unknown, fail: (e: unknown) => void) => fail({ code: 99 }),
    });

    await expect(currentPosition()).rejects.toThrow("現在地を取得できませんでした");
  });
});

describe("mapLink", () => {
  it("builds a Google Maps search URL from a point", () => {
    expect(mapLink({ lat: 35.68, lon: 139.76 })).toBe(
      "https://www.google.com/maps/search/?api=1&query=35.68,139.76",
    );
  });

  it("keeps negative coordinates intact", () => {
    expect(mapLink({ lat: -33.86, lon: -151.2 })).toContain("query=-33.86,-151.2");
  });
});

/** Image / canvas を差し替えて shrinkImage を決定的に動かす */
function stubImagePipeline(opts: {
  width: number;
  height: number;
  fail?: boolean;
  ctx?: unknown;
  blob?: Blob | null;
}) {
  const objectUrl = "blob:stub";
  const revoke = vi.fn();
  vi.stubGlobal("URL", { createObjectURL: () => objectUrl, revokeObjectURL: revoke });

  class StubImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    width = opts.width;
    height = opts.height;
    set src(_v: string) {
      queueMicrotask(() => (opts.fail ? this.onerror?.() : this.onload?.()));
    }
  }
  vi.stubGlobal("Image", StubImage);

  const canvas = {
    width: 0,
    height: 0,
    getContext: () => (opts.ctx === undefined ? { drawImage: vi.fn() } : opts.ctx),
    toBlob: (cb: (b: Blob | null) => void) =>
      cb(opts.blob === undefined ? new Blob(["small"], { type: "image/jpeg" }) : opts.blob),
  };
  vi.spyOn(document, "createElement").mockImplementation((tag: string) =>
    tag === "canvas" ? (canvas as unknown as HTMLElement) : document.createElement(tag),
  );

  return { canvas, revoke };
}

function imageFile(size: number, type = "image/png") {
  const file = new File(["x"], "in.png", { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("shrinkImage", () => {
  it("returns non-image files untouched", async () => {
    const pdf = new File(["x"], "doc.pdf", { type: "application/pdf" });
    await expect(shrinkImage(pdf)).resolves.toBe(pdf);
  });

  it("returns small images that need no scaling untouched", async () => {
    stubImagePipeline({ width: 800, height: 600 });
    const file = imageFile(500 * 1024);

    await expect(shrinkImage(file)).resolves.toBe(file);
  });

  it("re-encodes a small-dimension image that is over 1MB", async () => {
    stubImagePipeline({ width: 800, height: 600 });
    const out = await shrinkImage(imageFile(2 * 1024 * 1024));

    expect(out.type).toBe("image/jpeg");
    expect(out.name).toBe("photo.jpg");
  });

  it("scales the longest edge down to 1600px, preserving aspect ratio", async () => {
    const { canvas } = stubImagePipeline({ width: 3200, height: 1600 });

    await shrinkImage(imageFile(5 * 1024 * 1024));

    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(800);
  });

  it("scales by the taller edge for portrait images", async () => {
    const { canvas } = stubImagePipeline({ width: 1000, height: 4000 });

    await shrinkImage(imageFile(5 * 1024 * 1024));

    expect(canvas.height).toBe(1600);
    expect(canvas.width).toBe(400);
  });

  it("releases the object URL after loading", async () => {
    const { revoke } = stubImagePipeline({ width: 3200, height: 1600 });

    await shrinkImage(imageFile(5 * 1024 * 1024));

    expect(revoke).toHaveBeenCalledWith("blob:stub");
  });

  it("falls back to the original file when the image fails to load", async () => {
    const { revoke } = stubImagePipeline({ width: 0, height: 0, fail: true });
    const file = imageFile(5 * 1024 * 1024);

    await expect(shrinkImage(file)).resolves.toBe(file);
    expect(revoke).toHaveBeenCalled();
  });

  it("falls back to the original file when no 2D context is available", async () => {
    stubImagePipeline({ width: 3200, height: 1600, ctx: null });
    const file = imageFile(5 * 1024 * 1024);

    await expect(shrinkImage(file)).resolves.toBe(file);
  });

  it("falls back to the original file when encoding produces no blob", async () => {
    stubImagePipeline({ width: 3200, height: 1600, blob: null });
    const file = imageFile(5 * 1024 * 1024);

    await expect(shrinkImage(file)).resolves.toBe(file);
  });
});
