import { describe, expect, it } from "vitest";
import { Card } from "../src/domain/card/Card";
import { Match } from "../src/domain/match/Match";
import { MatchingEngine } from "../src/domain/match/MatchingEngine";
import { Message } from "../src/domain/message/Message";
import { Report } from "../src/domain/report/Report";
import { Review } from "../src/domain/review/Review";
import { Location } from "../src/domain/shared/Location";
import { Swipe } from "../src/domain/feed/Swipe";
import { Tag } from "../src/domain/tag/Tag";
import { UploadPolicy } from "../src/domain/upload/UploadPolicy";
import { User } from "../src/domain/user/User";

function openCard(
  overrides: Partial<Parameters<typeof Card.create>[0]> & {
    ownerId: string;
    type: "GIVE" | "WANT" | "COMPANION";
    title: string;
  },
) {
  return Card.create({
    minMatchCount: 1,
    tags: ["tag1"],
    requiredTags: [],
    dates: [],
    ...overrides,
  });
}

describe("Location", () => {
  it("computes distance and labels", () => {
    const tokyo = new Location({ lat: 35.6812, lon: 139.7671, name: "東京" });
    const osaka = new Location({ lat: 34.6937, lon: 135.5023 });
    const km = tokyo.distanceKm(osaka);
    expect(km).toBeGreaterThan(350);
    expect(km).toBeLessThan(450);
    expect(tokyo.distanceLabel(osaka)).toMatch(/km$/);
    expect(tokyo.geohash()).toHaveLength(6);
    expect(tokyo.toJSON()).toEqual({ lat: 35.6812, lon: 139.7671, name: "東京" });
  });

  it("formatDistance shows meters under 1km", () => {
    expect(Location.formatDistance(0.3)).toMatch(/m$/);
    expect(Location.formatDistance(5)).toBe("5.0km");
  });

  it("precisionFor scales with radius", () => {
    expect(Location.precisionFor(1)).toBe(6);
    expect(Location.precisionFor(5)).toBe(5);
    expect(Location.precisionFor(20)).toBe(4);
  });

  it("cellsAround includes center and neighbors", () => {
    const cells = Location.cellsAround(35.68, 139.76);
    expect(cells.length).toBeGreaterThanOrEqual(2);
  });

  it("tryParse accepts valid object and rejects missing fields", () => {
    expect(Location.tryParse({ lat: 1, lon: 2 })?.lat).toBe(1);
    expect(Location.tryParse(null)).toBeNull();
    expect(Location.tryParse({ lat: 1 })).toBeNull();
    expect(() => Location.tryParse({ lat: "bad", lon: 2 })).toThrow();
  });

  it("rejects out-of-range coordinates", () => {
    expect(() => new Location({ lat: 91, lon: 0 })).toThrow();
    expect(() => new Location({ lat: 0, lon: 181 })).toThrow();
  });
});

describe("Card", () => {
  it("isOpen returns false when expired or closed", () => {
    const expired = new Card({
      id: "c1",
      ownerId: "u1",
      type: "GIVE",
      title: "old",
      minMatchCount: 1,
      tags: [],
      requiredTags: [],
      dates: [],
      status: "OPEN",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(expired.isOpen()).toBe(false);

    const card = openCard({ ownerId: "u1", type: "GIVE", title: "active" });
    expect(card.isOpen()).toBe(true);
    card.close();
    expect(card.isOpen()).toBe(false);
  });

  it("isCounterpart maps GIVE/WANT/COMPANION correctly", () => {
    const give = openCard({ ownerId: "u1", type: "GIVE", title: "g" });
    expect(give.isCounterpart("WANT")).toBe(true);
    expect(give.isCounterpart("GIVE")).toBe(false);
    const companion = openCard({ ownerId: "u1", type: "COMPANION", title: "c" });
    expect(companion.isCounterpart("COMPANION")).toBe(true);
  });

  it("exposes location when set", () => {
    const card = openCard({
      ownerId: "u1",
      type: "WANT",
      title: "with loc",
      location: { lat: 35.6, lon: 139.7 },
    });
    expect(card.location?.lat).toBe(35.6);
  });
});

describe("Match", () => {
  it("acceptBy establishes match when both accept", () => {
    const match = Match.create("a", "b", "u1", "u2", ["tag1"]);
    expect(match.status).toBe("PENDING");
    expect(match.acceptBy("u1")).toBe(false);
    expect(match.acceptedA).toBe(true);
    expect(match.acceptBy("u2")).toBe(true);
    expect(match.status).toBe("ACCEPTED");
  });

  it("partnerOf and isParty work", () => {
    const match = Match.create("a", "b", "u1", "u2", ["tag1"]);
    expect(match.partnerOf("u1")).toBe("u2");
    expect(match.isParty("u3")).toBe(false);
    match.decline();
    expect(match.status).toBe("DECLINED");
    match.complete();
    expect(match.status).toBe("COMPLETED");
  });

  it("records messages and creates stable id", () => {
    const id = Match.createId("card-b", "card-a");
    expect(id).toBe(Match.createId("card-a", "card-b"));
    const match = Match.create("a", "b", "u1", "u2", ["t"], { distanceKm: 1.2 });
    match.recordMessage("u1", "2024-01-01T00:00:00Z", "hello");
    expect(match.lastMessagePreview).toBe("hello");
    expect(match.toProps().matchCount).toBe(1);
    expect(match.cardAId).toBe("a");
    expect(match.distanceKm).toBe(1.2);
    expect(match.matchedTags).toEqual(["t"]);
  });
});

describe("MatchingEngine extended", () => {
  it("satisfies returns matched tags for valid WANT/GIVE pair", () => {
    const want = openCard({
      ownerId: "u1",
      type: "WANT",
      title: "want",
      tags: ["a", "b"],
      minMatchCount: 2,
    });
    const give = openCard({
      ownerId: "u2",
      type: "GIVE",
      title: "give",
      tags: ["a", "b", "c"],
    });
    expect(MatchingEngine.satisfies(want, give)).toEqual(["a", "b"]);
  });

  it("satisfies rejects same owner and wrong types", () => {
    const want = openCard({ ownerId: "u1", type: "WANT", title: "w" });
    const giveSame = openCard({ ownerId: "u1", type: "GIVE", title: "g" });
    expect(MatchingEngine.satisfies(want, giveSame)).toBeNull();
    expect(MatchingEngine.satisfies(want, want)).toBeNull();
  });

  it("satisfies requires common dates when both specify dates", () => {
    const want = openCard({
      ownerId: "u1",
      type: "WANT",
      title: "w",
      tags: ["a", "b"],
      minMatchCount: 1,
      dates: ["2026-01-01"],
    });
    const giveNoDate = openCard({ ownerId: "u2", type: "GIVE", title: "g", tags: ["a", "b"] });
    expect(MatchingEngine.satisfies(want, giveNoDate)).toEqual(["a", "b"]);

    const giveWrongDate = openCard({
      ownerId: "u2",
      type: "GIVE",
      title: "g",
      tags: ["a", "b"],
      dates: ["2026-02-01"],
    });
    expect(MatchingEngine.satisfies(want, giveWrongDate)).toBeNull();
  });

  it("evaluate skips suspended users and closed cards", () => {
    const owner = User.create("a@b.com", "h", "s", "Owner");
    owner.incrementReport();
    owner.incrementReport();
    owner.incrementReport();
    const card = openCard({ ownerId: "u1", type: "WANT", title: "w", tags: ["a"] });
    const target = openCard({ ownerId: "u2", type: "GIVE", title: "g", tags: ["a"] });
    expect(MatchingEngine.evaluate(card, target, ["a"], owner)).toBeNull();
  });

  it("evaluate notifies only party meeting threshold", () => {
    const high = openCard({
      ownerId: "u1",
      type: "WANT",
      title: "w",
      tags: ["a", "b"],
      minMatchCount: 3,
    });
    const low = openCard({
      ownerId: "u2",
      type: "GIVE",
      title: "g",
      tags: ["a", "b"],
      minMatchCount: 1,
    });
    const result = MatchingEngine.evaluate(high, low, ["a", "b"]);
    expect(result?.notifyOwner).toBe(false);
    expect(result?.notifyTarget).toBe(true);
  });
});

describe("User extended", () => {
  it("updates profile, favorites, and home", () => {
    const user = User.create("a@b.com", "h", "s", "Name");
    user.updateProfile("New Name", "https://example.com/p.png");
    expect(user.displayName).toBe("New Name");
    user.setFavorites(["tag1"], { tag1: "Label" });
    expect(user.favoriteTags).toEqual(["tag1"]);
    user.setHomeLocation(new Location({ lat: 35, lon: 139 }));
    expect(user.homeLocation?.lat).toBe(35);
    user.setHomeLocation(undefined);
    expect(user.homeLocation).toBeUndefined();
  });

  it("applyReview updates rating and trade count", () => {
    const user = User.create("a@b.com", "h", "s", "Name");
    user.applyReview(5);
    expect(user.ratingCount).toBe(1);
    expect(user.ratingAvg).toBe(5);
    expect(user.tradeCount).toBe(1);
    const profile = user.toPublicProfile();
    expect(profile.isNew).toBe(false);
    expect(profile.ratingAvg).toBe(5);
  });

  it("toPublicProfile shows null rating when no reviews", () => {
    const user = User.create("a@b.com", "h", "s", "Name");
    expect(user.toPublicProfile().ratingAvg).toBeNull();
    expect(user.toPublicProfile().isNew).toBe(true);
  });
});

describe("Report", () => {
  it("creates valid report and rejects self-report", () => {
    const report = Report.create({
      reporterId: "u1",
      targetUserId: "u2",
      reason: "FRAUD",
      detail: "  detail  ",
      matchId: "m1",
    });
    expect(report.reasonLabel).toBe("詐欺の疑い");
    expect(report.detail).toBe("detail");
    expect(report.matchId).toBe("m1");
    expect(report.status).toBe("PENDING");
    expect(report.reporterId).toBe("u1");
    expect(report.toProps().targetUserId).toBe("u2");
    expect(() =>
      Report.create({ reporterId: "u1", targetUserId: "u1", matchId: "m1", reason: "OTHER" }),
    ).toThrow();
  });
});

describe("Review", () => {
  it("creates review and validates rating", () => {
    const review = Review.create({
      matchId: "m1",
      fromUserId: "u1",
      toUserId: "u2",
      rating: 4,
      comment: " good ",
    });
    expect(review.rating).toBe(4);
    expect(review.comment).toBe("good");
    expect(review.matchId).toBe("m1");
    expect(review.fromUserId).toBe("u1");
    expect(review.toUserId).toBe("u2");
    expect(review.id).toBeTruthy();
    expect(review.toProps().rating).toBe(4);
    expect(() =>
      Review.create({ matchId: "m1", fromUserId: "u1", toUserId: "u2", rating: 6 }),
    ).toThrow();
  });
});

describe("Message", () => {
  it("creates text, image, and location messages", () => {
    const text = Message.create({
      threadType: "MATCH",
      threadId: "m1",
      senderId: "u1",
      text: "hello",
    });
    expect(text.kind).toBe("text");
    expect(text.preview()).toBe("hello");

    const image = Message.create({
      threadType: "MATCH",
      threadId: "m1",
      senderId: "u1",
      imageKey: "chat/m1/x.png",
    });
    expect(image.preview()).toBe("[画像]");

    const loc = Message.create({
      threadType: "GROUP",
      threadId: "g1",
      senderId: "u1",
      location: { lat: 1, lon: 2 },
    });
    expect(loc.preview()).toBe("[位置情報]");
  });

  it("rejects empty message and long text", () => {
    expect(() => Message.create({ threadType: "MATCH", threadId: "m1", senderId: "u1" })).toThrow();
    expect(() =>
      Message.create({
        threadType: "MATCH",
        threadId: "m1",
        senderId: "u1",
        text: "x".repeat(1001),
      }),
    ).toThrow();
  });

  it("exposes getters and toProps", () => {
    const msg = Message.create({
      threadType: "MATCH",
      threadId: "m1",
      senderId: "u1",
      text: "hi",
    });
    expect(msg.threadType).toBe("MATCH");
    expect(msg.threadId).toBe("m1");
    expect(msg.senderId).toBe("u1");
    expect(msg.createdAt).toBeTruthy();
    expect(msg.toProps().text).toBe("hi");
  });
});

describe("Tag and Swipe", () => {
  it("Tag increments use count", () => {
    const tag = Tag.create("プロセカ", "game");
    expect(tag.id).toBeTruthy();
    tag.incrementUseCount();
    expect(tag.useCount).toBe(2);
  });

  it("Swipe stores action", () => {
    const swipe = Swipe.create("u1", "c1", "save");
    expect(swipe.action).toBe("save");
    expect(swipe.toProps().cardId).toBe("c1");
  });
});

describe("UploadPolicy", () => {
  it("validates content type and size", () => {
    expect(UploadPolicy.validateContentType("image/png")).toBe("image/png");
    expect(() => UploadPolicy.validateContentType("application/pdf")).toThrow();
    expect(() => UploadPolicy.validateSize(6 * 1024 * 1024)).toThrow();
  });

  it("builds image keys and validates thread ownership", () => {
    const key = UploadPolicy.imageKey("thread-1", "image/jpeg");
    expect(key).toMatch(/^chat\/thread-1\/.+\.jpg$/);
    expect(() => UploadPolicy.assertKeyBelongsToThread(key, "other")).toThrow();
    UploadPolicy.assertKeyBelongsToThread(key, "thread-1");
  });
});
