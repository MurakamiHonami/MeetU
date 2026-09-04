import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CardItem from "./CardItem";
import type { Card } from "../entities/card/model";

const base: Card = {
  cardId: "c1",
  type: "GIVE",
  title: "アクスタ譲ります",
  tags: [{ tagId: "t1", name: "推しA" }],
  requiredTags: [],
  minMatchCount: 1,
  status: "OPEN",
  createdAt: "2026-01-01T00:00:00Z",
};

const renderCard = (card: Partial<Card> = {}, props = {}) =>
  render(<CardItem card={{ ...base, ...card }} {...props} />);

describe("CardItem", () => {
  it("shows the title and the type badge", () => {
    renderCard();

    expect(screen.getByText("アクスタ譲ります")).toBeInTheDocument();
    expect(screen.getByText("【譲】")).toBeInTheDocument();
  });

  it.each([
    ["GIVE", "【譲】"],
    ["WANT", "【求】"],
    ["COMPANION", "【同行者求】"],
  ] as const)("labels a %s card as %s", (type, label) => {
    renderCard({ type });
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("lists the tags", () => {
    renderCard({
      tags: [
        { tagId: "t1", name: "推しA" },
        { tagId: "t2", name: "推しB" },
      ],
    });

    expect(screen.getByText("推しA")).toBeInTheDocument();
    expect(screen.getByText("推しB")).toBeInTheDocument();
  });

  it("highlights the tags that matched", () => {
    renderCard({
      tags: [
        { tagId: "t1", name: "推しA" },
        { tagId: "t2", name: "推しB" },
      ],
      matchedTags: ["推しA"],
    });

    expect(screen.getByText("推しA")).toHaveClass("chip-matched");
    expect(screen.getByText("推しB")).not.toHaveClass("chip-matched");
  });

  it("stars the required tags", () => {
    renderCard({ tags: [{ tagId: "t1", name: "推しA" }], requiredTags: ["t1"] });

    // ★ とタグ名は同じ chip 内の兄弟ノードなので、chip 全体のテキストで確認する
    const chip = document.querySelector(".chip")!;
    expect(chip).toHaveTextContent("★推しA");
    expect(chip).toHaveClass("chip-required");
  });

  it("shows the match count when present", () => {
    renderCard({ matchCount: 3 });
    expect(screen.getByText("3件")).toBeInTheDocument();
  });

  it("shows a zero match count rather than hiding it", () => {
    renderCard({ matchCount: 0 });
    expect(screen.getByText("0件")).toBeInTheDocument();
  });

  it("omits the match line when there is no count", () => {
    renderCard();
    expect(screen.queryByText(/一致/)).not.toBeInTheDocument();
  });

  it("joins multiple dates", () => {
    renderCard({ dates: ["1/10", "1/11"] });
    expect(screen.getByText("1/10 / 1/11")).toBeInTheDocument();
  });

  it("shows the location name when given", () => {
    renderCard({ location: { lat: 35.68, lon: 139.76, name: "東京駅" } });
    expect(screen.getByText(/東京駅/)).toBeInTheDocument();
  });

  it("falls back to a generic location label", () => {
    renderCard({ location: { lat: 35.68, lon: 139.76 } });
    expect(screen.getByText(/位置情報あり/)).toBeInTheDocument();
  });

  it("shows the distance label alongside the location", () => {
    renderCard({ location: { lat: 35.68, lon: 139.76 }, distanceLabel: "1.2km" });
    expect(screen.getByText("1.2km")).toBeInTheDocument();
  });

  it("shows the note when present", () => {
    renderCard({ note: "土日に受け渡し希望です" });
    expect(screen.getByText("土日に受け渡し希望です")).toBeInTheDocument();
  });

  it("shows the owner's rating", () => {
    renderCard({
      owner: {
        userId: "u2",
        displayName: "たかし",
        ratingAvg: 4.5,
        ratingCount: 8,
        tradeCount: 8,
        isNew: false,
      },
    });

    expect(screen.getByText("たかし")).toBeInTheDocument();
    expect(screen.getByText("★4.5（8件）")).toBeInTheDocument();
  });

  it("marks a new owner instead of showing a rating", () => {
    renderCard({
      owner: {
        userId: "u2",
        displayName: "はじめ",
        ratingAvg: null,
        ratingCount: 0,
        tradeCount: 0,
        isNew: true,
      },
    });

    expect(screen.getByText("新規")).toBeInTheDocument();
    expect(screen.queryByText(/★/)).not.toBeInTheDocument();
  });

  it("says when the card is closed", () => {
    renderCard({ status: "CLOSED" });
    expect(screen.getByText("このカードは終了しています")).toBeInTheDocument();
  });

  it("does not say closed for an open card", () => {
    renderCard({ status: "OPEN" });
    expect(screen.queryByText("このカードは終了しています")).not.toBeInTheDocument();
  });

  it("calls onClick and marks itself clickable", () => {
    const onClick = vi.fn();
    renderCard({}, { onClick });

    const article = document.querySelector("article")!;
    expect(article).toHaveClass("card-clickable");
    fireEvent.click(article);

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is not clickable without an onClick handler", () => {
    renderCard();
    expect(document.querySelector("article")).not.toHaveClass("card-clickable");
  });

  it("renders a footer when given", () => {
    renderCard({}, { footer: <button>保存を解除</button> });
    expect(screen.getByRole("button", { name: "保存を解除" })).toBeInTheDocument();
  });
});
