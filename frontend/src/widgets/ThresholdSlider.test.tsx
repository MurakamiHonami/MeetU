import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import ThresholdSlider from "./ThresholdSlider";

function setup(props: Partial<React.ComponentProps<typeof ThresholdSlider>> = {}) {
  const onChange = vi.fn();
  render(<ThresholdSlider value={1} max={5} requiredCount={0} onChange={onChange} {...props} />);
  return { onChange };
}

const slider = () => screen.getByRole("slider") as HTMLInputElement;

describe("ThresholdSlider", () => {
  it("prompts to add tags when there are none", () => {
    setup({ max: 0 });

    expect(screen.getByText("タグを追加すると、通知の条件を設定できます。")).toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("shows the current threshold", () => {
    setup({ value: 3, max: 5 });

    expect(screen.getByText("3件以上")).toBeInTheDocument();
    expect(slider().value).toBe("3");
  });

  it("reports the total tag count in the hint", () => {
    setup({ value: 2, max: 5 });

    expect(screen.getByText(/全5件のタグのうち/)).toBeInTheDocument();
  });

  it("emits the new value as a number when dragged", () => {
    const { onChange } = setup({ value: 1, max: 5 });

    fireEvent.change(slider(), { target: { value: "4" } });

    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("clamps a value below the minimum up to 1", () => {
    setup({ value: 0, max: 5 });

    expect(slider().value).toBe("1");
    expect(screen.getByText("1件以上")).toBeInTheDocument();
  });

  it("clamps a value above the maximum down to max", () => {
    setup({ value: 99, max: 5 });

    expect(slider().value).toBe("5");
    expect(screen.getByText("5件以上")).toBeInTheDocument();
  });

  it("raises the floor to the number of required tags", () => {
    setup({ value: 1, max: 5, requiredCount: 3 });

    expect(slider().min).toBe("3");
    expect(slider().value).toBe("3");
  });

  it("explains that required tags are always needed", () => {
    setup({ value: 3, max: 5, requiredCount: 2 });

    expect(screen.getByText(/必須タグ 2 件は常に必要です/)).toBeInTheDocument();
  });

  it("omits the required-tag note when there are none", () => {
    setup({ value: 3, max: 5, requiredCount: 0 });

    expect(screen.queryByText(/必須タグ/)).not.toBeInTheDocument();
  });

  it("disables the slider when there is only one possible value", () => {
    setup({ value: 1, max: 1 });

    expect(slider()).toBeDisabled();
  });

  it("disables the slider when required tags pin the range", () => {
    setup({ value: 3, max: 3, requiredCount: 3 });

    expect(slider()).toBeDisabled();
  });

  it("keeps the upper bound at least the minimum when required exceeds max", () => {
    setup({ value: 1, max: 2, requiredCount: 4 });

    expect(slider().min).toBe("4");
    expect(slider().max).toBe("4");
  });
});
