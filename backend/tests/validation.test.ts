import { describe, expect, it } from "vitest";
import { parseBody } from "../src/interfaces/validation/parseBody";
import {
  cardsSearchQuerySchema,
  createCardSchema,
  createReportSchema,
  createReviewSchema,
  createUploadTicketSchema,
  loginSchema,
  nearbyQuerySchema,
  sendMessageSchema,
  signupSchema,
  tagsQuerySchema,
  updateMeSchema,
} from "../src/interfaces/validation/schemas";

describe("Zod schemas", () => {
  it("signupSchema accepts valid input", () => {
    const result = parseBody(signupSchema, {
      email: "a@b.com",
      password: "password123",
      displayName: "Test",
    });
    expect(result.ok).toBe(true);
  });

  it("signupSchema rejects invalid email", () => {
    const result = parseBody(signupSchema, {
      email: "bad",
      password: "password123",
      displayName: "Test",
    });
    expect(result.ok).toBe(false);
  });

  it("createCardSchema requires tags", () => {
    const result = parseBody(createCardSchema, {
      type: "GIVE",
      title: "Test",
      tags: [],
    });
    expect(result.ok).toBe(false);
  });

  it("updateMeSchema accepts favorites", () => {
    const result = parseBody(updateMeSchema, { favorites: [{ name: "プロセカ" }] });
    expect(result.ok).toBe(true);
  });

  it("sendMessageSchema requires at least one field", () => {
    expect(parseBody(sendMessageSchema, {}).ok).toBe(false);
    expect(parseBody(sendMessageSchema, { text: "hello" }).ok).toBe(true);
  });

  it("createReviewSchema validates rating range", () => {
    expect(parseBody(createReviewSchema, { matchId: "m1", rating: 0 }).ok).toBe(false);
    expect(parseBody(createReviewSchema, { matchId: "m1", rating: 3 }).ok).toBe(true);
  });

  it("createReportSchema validates reason enum", () => {
    expect(
      parseBody(createReportSchema, {
        targetUserId: "u1",
        matchId: "m1",
        reason: "INVALID",
      }).ok,
    ).toBe(false);
    expect(
      parseBody(createReportSchema, {
        targetUserId: "u1",
        matchId: "m1",
        reason: "HARASSMENT",
      }).ok,
    ).toBe(true);
  });

  it("createReportSchema requires matchId", () => {
    expect(
      parseBody(createReportSchema, {
        targetUserId: "u1",
        reason: "HARASSMENT",
      }).ok,
    ).toBe(false);
  });

  it("createUploadTicketSchema requires matchId or groupId", () => {
    expect(parseBody(createUploadTicketSchema, { contentType: "image/png" }).ok).toBe(false);
    expect(
      parseBody(createUploadTicketSchema, { contentType: "image/png", matchId: "m1" }).ok,
    ).toBe(true);
  });

  it("nearbyQuerySchema coerces query strings", () => {
    const result = parseBody(nearbyQuerySchema, { lat: "35.6", lon: "139.7" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.lat).toBe(35.6);
      expect(result.data.lon).toBe(139.7);
    }
  });

  it("tagsQuerySchema defaults limit", () => {
    const result = parseBody(tagsQuerySchema, {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.limit).toBe(20);
  });

  it("cardsSearchQuerySchema defaults minMatch", () => {
    const result = parseBody(cardsSearchQuerySchema, {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.minMatch).toBe(1);
  });

  it("loginSchema requires password", () => {
    expect(parseBody(loginSchema, { email: "a@b.com", password: "" }).ok).toBe(false);
  });

  it("createCardSchema accepts location with lng alias", () => {
    const result = parseBody(createCardSchema, {
      type: "GIVE",
      title: "Test",
      tags: [{ displayName: "tag" }],
      location: { lat: 35.6, lng: 139.7, name: "Tokyo" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.location?.lon).toBe(139.7);
    }
  });

  it("updateMeSchema accepts homeLocation null", () => {
    expect(parseBody(updateMeSchema, { homeLocation: null }).ok).toBe(true);
  });

  it("updateMeSchema accepts displayName update", () => {
    expect(parseBody(updateMeSchema, { displayName: "New" }).ok).toBe(true);
  });

  it("sendMessageSchema accepts imageKey only", () => {
    expect(parseBody(sendMessageSchema, { imageKey: "chat/m1/x.png" }).ok).toBe(true);
  });

  it("nearbyQuerySchema rejects invalid lat", () => {
    expect(parseBody(nearbyQuerySchema, { lat: "abc", lon: "139" }).ok).toBe(false);
  });
});

describe("parseBody", () => {
  it("returns typed data on success", () => {
    const result = parseBody(signupSchema, {
      email: "x@y.z",
      password: "password1",
      displayName: "X",
    });
    if (result.ok) expect(result.data.email).toBe("x@y.z");
  });
});
