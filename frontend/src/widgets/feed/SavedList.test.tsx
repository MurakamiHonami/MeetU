import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const savedCards = vi.fn();
const unsaveCard = vi.fn();
const navigate = vi.fn();

vi.mock("../../features/feed/api", () => ({
  feedApi: {
    savedCards: (...a: unknown[]) => savedCards(...a),
    unsaveCard: (...a: unknown[]) => unsaveCard(...a),
  },
}));
vi.mock("../../shared/lib/navigation", () => ({
  useNavigate: () => navigate,
  useQueryParam: () => null,
}));

import { SavedList } from "./SavedList";
import type { Card } from "../../entities/card/model";

const card = (cardId: string, title: string): Card => ({
  cardId,
  type: "GIVE",
  title,
  tags: [],
  requiredTags: [],
  minMatchCount: 1,
  status: "OPEN",
  createdAt: "2026-01-01T00:00:00Z",
});

const setup = () => render(<SavedList />);

beforeEach(() => {
  vi.clearAllMocks();
  unsaveCard.mockResolvedValue({ cardId: "c1" });
});

describe("SavedList", () => {
  it("shows a loading state first", () => {
    savedCards.mockReturnValue(new Promise(() => {}));
    setup();

    expect(screen.getByText("読み込み中…")).toBeInTheDocument();
  });

  it("lists the saved cards", async () => {
    savedCards.mockResolvedValue({ cards: [card("c1", "アクスタ"), card("c2", "缶バッジ")] });
    setup();

    expect(await screen.findByText("アクスタ")).toBeInTheDocument();
    expect(screen.getByText("缶バッジ")).toBeInTheDocument();
  });

  it("explains how to save when the list is empty", async () => {
    savedCards.mockResolvedValue({ cards: [] });
    setup();

    expect(
      await screen.findByText("まだありません。ホームの新着を右にスワイプすると保存できます。"),
    ).toBeInTheDocument();
  });

  it("shows the error when loading fails", async () => {
    savedCards.mockRejectedValue(new Error("読み込めませんでした"));
    setup();

    expect(await screen.findByText("読み込めませんでした")).toBeInTheDocument();
  });

  it("opens the card detail when a card is clicked", async () => {
    savedCards.mockResolvedValue({ cards: [card("c1", "アクスタ")] });
    setup();
    await screen.findByText("アクスタ");

    fireEvent.click(screen.getByText("アクスタ").closest("article")!);

    expect(navigate).toHaveBeenCalledWith("/cards/c1");
  });

  it("removes a card from the list when unsaved", async () => {
    savedCards.mockResolvedValue({ cards: [card("c1", "アクスタ"), card("c2", "缶バッジ")] });
    setup();
    await screen.findByText("アクスタ");

    fireEvent.click(screen.getAllByRole("button", { name: "保存を解除" })[0]);

    await waitFor(() => expect(screen.queryByText("アクスタ")).not.toBeInTheDocument());
    expect(unsaveCard).toHaveBeenCalledWith("c1");
    expect(screen.getByText("缶バッジ")).toBeInTheDocument();
  });

  it("does not open the detail page when unsaving", async () => {
    savedCards.mockResolvedValue({ cards: [card("c1", "アクスタ")] });
    setup();
    await screen.findByText("アクスタ");

    fireEvent.click(screen.getByRole("button", { name: "保存を解除" }));

    await waitFor(() => expect(unsaveCard).toHaveBeenCalled());
    expect(navigate).not.toHaveBeenCalled();
  });

  it("shows the error and keeps the card when unsaving fails", async () => {
    savedCards.mockResolvedValue({ cards: [card("c1", "アクスタ")] });
    unsaveCard.mockRejectedValue(new Error("解除できませんでした"));
    setup();
    await screen.findByText("アクスタ");

    fireEvent.click(screen.getByRole("button", { name: "保存を解除" }));

    expect(await screen.findByText("解除できませんでした")).toBeInTheDocument();
  });
});
