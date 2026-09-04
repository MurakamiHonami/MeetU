import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const suggestTags = vi.fn();
vi.mock("../features/tag/api", () => ({
  tagApi: { suggestTags: (...a: unknown[]) => suggestTags(...a) },
}));

import TagInput from "./TagInput";

function setup(props: Partial<React.ComponentProps<typeof TagInput>> = {}) {
  const onChange = vi.fn();
  const onRequiredChange = vi.fn();
  const view = render(
    <TagInput
      value={[]}
      onChange={onChange}
      required={[]}
      onRequiredChange={onRequiredChange}
      {...props}
    />,
  );
  return { onChange, onRequiredChange, view };
}

const input = () => screen.getByRole("textbox") as HTMLInputElement;

/**
 * デバウンス(300ms)を進め、suggestTags の promise 解決と再レンダリングまで待つ。
 * fake timers 下では waitFor がポーリングできないので、ここで完全に流し切る。
 */
async function flushDebounce() {
  await act(async () => {
    vi.advanceTimersByTime(300);
    // setLoading -> await suggestTags -> setSuggestions のマイクロタスク連鎖を消化する
    await vi.advanceTimersByTimeAsync(0);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  suggestTags.mockReset();
  suggestTags.mockResolvedValue({ tags: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("chips", () => {
  it("shows a hint when no tags are picked", () => {
    setup();
    expect(screen.getByText("まだタグがありません")).toBeInTheDocument();
  });

  it("renders the picked tags", () => {
    setup({ value: [{ name: "推しA" }, { name: "推しB" }] });

    expect(screen.getByText("推しA")).toBeInTheDocument();
    expect(screen.getByText("推しB")).toBeInTheDocument();
    expect(screen.queryByText("まだタグがありません")).not.toBeInTheDocument();
  });

  it("removes a tag and drops it from required at the same time", () => {
    const { onChange, onRequiredChange } = setup({
      value: [{ name: "推しA" }, { name: "推しB" }],
      required: ["推しA"],
    });

    fireEvent.click(screen.getAllByText("×")[0]);

    expect(onChange).toHaveBeenCalledWith([{ name: "推しB" }]);
    expect(onRequiredChange).toHaveBeenCalledWith([]);
  });

  it("marks a tag as required with the star", () => {
    const { onRequiredChange } = setup({ value: [{ name: "推しA" }], required: [] });

    fireEvent.click(screen.getByTitle("必須にする"));

    expect(onRequiredChange).toHaveBeenCalledWith(["推しA"]);
  });

  it("unmarks a required tag", () => {
    const { onRequiredChange } = setup({ value: [{ name: "推しA" }], required: ["推しA"] });

    fireEvent.click(screen.getByTitle("必須をやめる"));

    expect(onRequiredChange).toHaveBeenCalledWith([]);
  });

  it("shows a filled star for required tags", () => {
    setup({ value: [{ name: "推しA" }], required: ["推しA"] });
    expect(screen.getByText("★")).toBeInTheDocument();
  });
});

describe("suggestions", () => {
  it("does not query while the input is empty", async () => {
    setup();
    await flushDebounce();
    expect(suggestTags).not.toHaveBeenCalled();
  });

  it("debounces the lookup rather than querying per keystroke", async () => {
    setup();

    fireEvent.change(input(), { target: { value: "推" } });
    fireEvent.change(input(), { target: { value: "推し" } });
    fireEvent.change(input(), { target: { value: "推しA" } });
    expect(suggestTags).not.toHaveBeenCalled();

    await flushDebounce();

    expect(suggestTags).toHaveBeenCalledOnce();
    expect(suggestTags).toHaveBeenCalledWith("推しA");
  });

  it("trims the query before sending it", async () => {
    setup();

    fireEvent.change(input(), { target: { value: "  推しA  " } });
    await flushDebounce();

    expect(suggestTags).toHaveBeenCalledWith("推しA");
  });

  it("lists the returned suggestions with their use counts", async () => {
    suggestTags.mockResolvedValue({ tags: [{ tagId: "t1", name: "推しA", useCount: 7 }] });
    setup();

    fireEvent.change(input(), { target: { value: "推し" } });
    await flushDebounce();

    expect(screen.getByText("推しA")).toBeInTheDocument();
    expect(screen.getByText("7件")).toBeInTheDocument();
  });

  it("shows 0件 for a tag with no use count", async () => {
    suggestTags.mockResolvedValue({ tags: [{ tagId: "t1", name: "推しA" }] });
    setup();

    fireEvent.change(input(), { target: { value: "推し" } });
    await flushDebounce();

    expect(screen.getByText("0件")).toBeInTheDocument();
  });

  it("hides suggestions for tags that are already picked", async () => {
    suggestTags.mockResolvedValue({
      tags: [
        { tagId: "t1", name: "推しA" },
        { tagId: "t2", name: "推しB" },
      ],
    });
    setup({ value: [{ name: "推しA" }] });

    fireEvent.change(input(), { target: { value: "推し" } });
    await flushDebounce();

    expect(screen.getByText("推しB")).toBeInTheDocument();
    // 推しA はチップとしてのみ存在し、候補には出ない
    expect(screen.queryByText("0件")).toBeInTheDocument();
    expect(screen.getAllByText("推しA")).toHaveLength(1);
  });

  it("offers to create a new tag when the server says it is unknown", async () => {
    suggestTags.mockResolvedValue({
      tags: [],
      createCandidate: { tagId: "new", name: "新タグ", isNew: true },
    });
    setup();

    fireEvent.change(input(), { target: { value: "新タグ" } });
    await flushDebounce();

    expect(screen.getByText("「新タグ」を新しく作る")).toBeInTheDocument();
  });

  it("still offers creation when the lookup fails", async () => {
    suggestTags.mockRejectedValue(new Error("offline"));
    setup();

    fireEvent.change(input(), { target: { value: "新タグ" } });
    await flushDebounce();

    expect(screen.getByText("「新タグ」を新しく作る")).toBeInTheDocument();
  });

  it("clears the suggestion list when the input is emptied", async () => {
    suggestTags.mockResolvedValue({ tags: [{ tagId: "t1", name: "推しA" }] });
    setup();

    fireEvent.change(input(), { target: { value: "推し" } });
    await flushDebounce();
    expect(screen.getByText("推しA")).toBeInTheDocument();

    fireEvent.change(input(), { target: { value: "" } });

    expect(screen.queryByText("推しA")).not.toBeInTheDocument();
  });
});

describe("adding tags", () => {
  it("adds the tag chosen from the suggestion list, with its category", async () => {
    suggestTags.mockResolvedValue({
      tags: [{ tagId: "t1", name: "推しA", category: "character" }],
    });
    const { onChange } = setup();

    fireEvent.change(input(), { target: { value: "推し" } });
    await flushDebounce();
    expect(screen.getByText("推しA")).toBeInTheDocument();

    fireEvent.click(screen.getByText("推しA"));

    expect(onChange).toHaveBeenCalledWith([{ name: "推しA", category: "character" }]);
  });

  it("adds a brand new tag from the create button", async () => {
    suggestTags.mockResolvedValue({
      tags: [],
      createCandidate: { tagId: "new", name: "新タグ", isNew: true },
    });
    const { onChange } = setup();

    fireEvent.change(input(), { target: { value: "新タグ" } });
    await flushDebounce();
    expect(screen.getByText("「新タグ」を新しく作る")).toBeInTheDocument();

    fireEvent.click(screen.getByText("「新タグ」を新しく作る"));

    expect(onChange).toHaveBeenCalledWith([{ name: "新タグ", category: undefined }]);
  });

  it("adds the first suggestion on Enter", async () => {
    suggestTags.mockResolvedValue({ tags: [{ tagId: "t1", name: "推しA" }] });
    const { onChange } = setup();

    fireEvent.change(input(), { target: { value: "推" } });
    await flushDebounce();
    expect(screen.getByText("推しA")).toBeInTheDocument();

    fireEvent.keyDown(input(), { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith([{ name: "推しA", category: undefined }]);
  });

  it("adds the raw text on Enter when there is no suggestion", async () => {
    const { onChange } = setup();

    fireEvent.change(input(), { target: { value: "自作タグ" } });
    await flushDebounce();

    fireEvent.keyDown(input(), { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith([{ name: "自作タグ", category: undefined }]);
  });

  it("trims whitespace from a typed tag", async () => {
    const { onChange } = setup();

    fireEvent.change(input(), { target: { value: "  自作タグ  " } });
    await flushDebounce();
    fireEvent.keyDown(input(), { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith([{ name: "自作タグ", category: undefined }]);
  });

  it("ignores Enter on an empty input", () => {
    const { onChange } = setup();

    fireEvent.keyDown(input(), { key: "Enter" });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not add a duplicate tag", async () => {
    const { onChange } = setup({ value: [{ name: "推しA" }] });

    fireEvent.change(input(), { target: { value: "推しA" } });
    await flushDebounce();
    fireEvent.keyDown(input(), { key: "Enter" });

    expect(onChange).not.toHaveBeenCalled();
    expect(input().value).toBe("");
  });

  it("clears the input after adding a tag", async () => {
    const { onChange } = setup();

    fireEvent.change(input(), { target: { value: "自作タグ" } });
    await flushDebounce();
    fireEvent.keyDown(input(), { key: "Enter" });

    expect(onChange).toHaveBeenCalled();
    expect(input().value).toBe("");
  });
});

describe("the maximum number of tags", () => {
  const nine = Array.from({ length: 9 }, (_, i) => ({ name: `t${i}` }));

  it("allows adding while below the limit", async () => {
    const { onChange } = setup({ value: nine, max: 10 });

    expect(input()).not.toBeDisabled();
    fireEvent.change(input(), { target: { value: "最後" } });
    await flushDebounce();
    fireEvent.keyDown(input(), { key: "Enter" });

    expect(onChange).toHaveBeenCalled();
  });

  it("disables the input at the limit", () => {
    setup({ value: [...nine, { name: "t9" }], max: 10 });

    expect(input()).toBeDisabled();
    expect(input().placeholder).toBe("タグは10個までです");
  });

  it("respects a custom maximum", () => {
    setup({ value: [{ name: "a" }, { name: "b" }], max: 2 });

    expect(input()).toBeDisabled();
    expect(input().placeholder).toBe("タグは2個までです");
  });
});
