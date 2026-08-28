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
        reason: "INVALID",
      }).ok,
    ).toBe(false);
    expect(
      parseBody(createReportSchema, {
        targetUserId: "u1",
        reason: "HARASSMENT",
      }).ok,
    ).toBe(true);
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
});
