import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const respondOptions = vi.fn();
const respond = vi.fn();
const navigate = vi.fn();

vi.mock("../features/card/api", () => ({
  cardApi: {
    respondOptions: (...a: unknown[]) => respondOptions(...a),
    respond: (...a: unknown[]) => respond(...a),
  },
}));
vi.mock("../shared/lib/navigation", () => ({
  useNavigate: () => navigate,
  useQueryParam: () => null,
}));

import RespondToCardButton from "./RespondToCardButton";
import type { Card } from "../entities/card/model";

const card: Card = {
  cardId: "target",
  type: "WANT",
  title: "アクスタ求む",
  tags: [{ tagId: "t1", name: "推しA" }],
  requiredTags: [],
  minMatchCount: 1,
  status: "OPEN",
  createdAt: "2026-01-01T00:00:00Z",
};

const myCard = (cardId: string, title: string): Card => ({ ...card, cardId, title, type: "GIVE" });

function setup(props = {}) {
  const onResponded = vi.fn();
  render(<RespondToCardButton card={card} onResponded={onResponded} {...props} />);
  return { onResponded };
}

const trigger = () => screen.getByRole("button", { name: /この条件で応募する|確認中/ });

beforeEach(() => vi.clearAllMocks());

describe("starting a response", () => {
  it("fetches the options for this card", async () => {
    respondOptions.mockResolvedValue({ targetCard: card, options: [] });
    setup();

    fireEvent.click(trigger());

    await waitFor(() => expect(respondOptions).toHaveBeenCalledWith("target"));
  });

  it("shows progress and disables the button while loading", async () => {
    let release!: (v: unknown) => void;
    respondOptions.mockReturnValue(new Promise((r) => (release = r)));
    setup();

    fireEvent.click(trigger());

    expect(await screen.findByRole("button", { name: /確認中/ })).toBeDisabled();
    release({ targetCard: card, options: [] });
  });

  it("sends the user to card creation when they have no matching card", async () => {
    respondOptions.mockResolvedValue({ targetCard: card, options: [] });
    setup();

    fireEvent.click(trigger());

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/cards/new?respondTo=target"));
    expect(respond).not.toHaveBeenCalled();
  });

  it("responds immediately when exactly one card qualifies", async () => {
    respondOptions.mockResolvedValue({
      targetCard: card,
      options: [
        { card: myCard("mine", "アクスタ譲ります"), matchedTags: ["推しA"], matchCount: 1 },
      ],
    });
    respond.mockResolvedValue({ created: true, match: { matchId: "m1" } });
    setup();

    fireEvent.click(trigger());

    await waitFor(() => expect(respond).toHaveBeenCalledWith("target", "mine"));
    expect(navigate).toHaveBeenCalledWith("/matches/m1");
  });

  it("shows the error when fetching options fails", async () => {
    respondOptions.mockRejectedValue(new Error("応募できません"));
    setup();

    fireEvent.click(trigger());

    expect(await screen.findByText("応募できません")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("re-enables the button after a failure", async () => {
    respondOptions.mockRejectedValue(new Error("応募できません"));
    setup();

    fireEvent.click(trigger());

    await screen.findByText("応募できません");
    expect(trigger()).not.toBeDisabled();
  });
});

describe("picking among several cards", () => {
  const twoOptions = {
    targetCard: card,
    options: [
      { card: myCard("mine1", "アクスタ譲ります"), matchedTags: ["推しA"], matchCount: 1 },
      { card: myCard("mine2", "缶バッジ譲ります"), matchedTags: ["推しA"], matchCount: 1 },
    ],
  };

  async function openPicker() {
    respondOptions.mockResolvedValue(twoOptions);
    const r = setup();
    fireEvent.click(trigger());
    await screen.findByText("どのカードで応募しますか？");
    return r;
  }

  it("opens a picker listing every qualifying card", async () => {
    await openPicker();

    expect(screen.getByText("アクスタ譲ります")).toBeInTheDocument();
    expect(screen.getByText("缶バッジ譲ります")).toBeInTheDocument();
    expect(respond).not.toHaveBeenCalled();
  });

  it("responds with the card the user picks", async () => {
    respond.mockResolvedValue({ created: true, match: { matchId: "m2" } });
    const { onResponded } = await openPicker();

    fireEvent.click(screen.getByText("缶バッジ譲ります"));

    await waitFor(() => expect(respond).toHaveBeenCalledWith("target", "mine2"));
    expect(onResponded).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith("/matches/m2");
  });

  it("closes the picker after a successful response", async () => {
    respond.mockResolvedValue({ created: true, match: { matchId: "m2" } });
    await openPicker();

    fireEvent.click(screen.getByText("アクスタ譲ります"));

    await waitFor(() =>
      expect(screen.queryByText("どのカードで応募しますか？")).not.toBeInTheDocument(),
    );
  });

  it("shows the error and closes the picker when responding fails", async () => {
    respond.mockRejectedValue(new Error("すでにマッチ済みです"));
    await openPicker();

    fireEvent.click(screen.getByText("アクスタ譲ります"));

    expect(await screen.findByText("すでにマッチ済みです")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("offers creating a new card from the picker", async () => {
    await openPicker();

    fireEvent.click(screen.getByRole("button", { name: "新しいカードを作る" }));

    expect(navigate).toHaveBeenCalledWith("/cards/new?respondTo=target");
  });

  it("closes on cancel without responding", async () => {
    await openPicker();

    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(screen.queryByText("どのカードで応募しますか？")).not.toBeInTheDocument();
    expect(respond).not.toHaveBeenCalled();
  });

  it("closes when the backdrop is clicked", async () => {
    await openPicker();

    fireEvent.click(document.querySelector(".modal-backdrop")!);

    expect(screen.queryByText("どのカードで応募しますか？")).not.toBeInTheDocument();
  });

  it("keeps the picker open when the modal body is clicked", async () => {
    await openPicker();

    fireEvent.click(document.querySelector(".modal")!);

    expect(screen.getByText("どのカードで応募しますか？")).toBeInTheDocument();
  });

  it("shows each option's match count", async () => {
    await openPicker();

    expect(screen.getAllByText("1件")).toHaveLength(2);
  });
});

describe("styling", () => {
  it("uses the primary class by default", () => {
    setup();
    expect(trigger()).toHaveClass("primary");
  });

  it("accepts a custom class", () => {
    setup({ className: "ghost" });
    expect(trigger()).toHaveClass("ghost");
  });
});
