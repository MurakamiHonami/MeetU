import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const getCard = vi.fn();
const navigate = vi.fn();

vi.mock("../../features/card/api", () => ({
  cardApi: {
    card: (...a: unknown[]) => getCard(...a),
    respondOptions: vi.fn(),
    respond: vi.fn(),
  },
}));
vi.mock("../../shared/lib/navigation", () => ({
  useNavigate: () => navigate,
  useQueryParam: () => null,
}));

import { CardDetailView } from "./CardDetailView";
import type { Card } from "../../entities/card/model";

const card: Card = {
  cardId: "c1",
  type: "GIVE",
  title: "アクスタ譲ります",
  tags: [{ tagId: "t1", name: "推しA" }],
  requiredTags: [],
  minMatchCount: 1,
  status: "OPEN",
  createdAt: "2026-01-01T00:00:00Z",
};

const setup = (cardId = "c1") => render(<CardDetailView cardId={cardId} />);

beforeEach(() => vi.clearAllMocks());

describe("CardDetailView", () => {
  it("shows a loading state first", () => {
    getCard.mockReturnValue(new Promise(() => {}));
    setup();

    expect(screen.getByText("読み込み中…")).toBeInTheDocument();
  });

  it("fetches the card by the given id", async () => {
    getCard.mockResolvedValue({ card });
    setup("c9");

    expect(await screen.findByText("カードの詳細")).toBeInTheDocument();
    expect(getCard).toHaveBeenCalledWith("c9");
  });

  it("renders the card once loaded", async () => {
    getCard.mockResolvedValue({ card });
    setup();

    expect(await screen.findByText("アクスタ譲ります")).toBeInTheDocument();
    expect(screen.getByText("推しA")).toBeInTheDocument();
  });

  it("offers the respond action", async () => {
    getCard.mockResolvedValue({ card });
    setup();

    expect(await screen.findByRole("button", { name: /この条件で応募する/ })).toBeInTheDocument();
  });

  it("goes back in history when 戻る is pressed", async () => {
    getCard.mockResolvedValue({ card });
    setup();
    await screen.findByText("アクスタ譲ります");

    fireEvent.click(screen.getByRole("button", { name: "戻る" }));

    expect(navigate).toHaveBeenCalledWith(-1);
  });

  it("shows the error instead of the card when loading fails", async () => {
    getCard.mockRejectedValue(new Error("カードが見つかりません"));
    setup();

    expect(await screen.findByText("カードが見つかりません")).toBeInTheDocument();
    expect(screen.queryByText("カードの詳細")).not.toBeInTheDocument();
  });
});
