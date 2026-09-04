import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatComposer } from "./ChatComposer";

function setup(props: Partial<React.ComponentProps<typeof ChatComposer>> = {}) {
  const handlers = {
    onTextChange: vi.fn(),
    onSendText: vi.fn(),
    onSendImage: vi.fn(),
    onSendLocation: vi.fn(),
  };
  render(
    <ChatComposer
      text=""
      sending={false}
      busyLabel=""
      lockedMessage="このチャットは終了しています"
      canSend
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

const textarea = () => screen.getByPlaceholderText("メッセージを入力");
// 送信ボタンはアイコンのみでアクセシブルネームを持たないため、クラスで特定する
const sendButton = () => document.querySelector("button.chat-send") as HTMLButtonElement;

describe("ChatComposer", () => {
  it("shows only the locked message when sending is not allowed", () => {
    setup({ canSend: false });

    expect(screen.getByText("このチャットは終了しています")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("メッセージを入力")).not.toBeInTheDocument();
  });

  it("renders the composer when sending is allowed", () => {
    setup();
    expect(textarea()).toBeInTheDocument();
  });

  it("shows a busy label when one is given", () => {
    setup({ busyLabel: "送信中…" });
    expect(screen.getByText("送信中…")).toBeInTheDocument();
  });

  it("reports each keystroke to the parent", () => {
    const { onTextChange } = setup();

    fireEvent.change(textarea(), { target: { value: "こん" } });

    expect(onTextChange).toHaveBeenCalledWith("こん");
  });

  it("limits the message length", () => {
    setup();
    expect(textarea()).toHaveAttribute("maxLength", "1000");
  });

  it("sends on Enter", () => {
    const { onSendText } = setup({ text: "hi" });

    fireEvent.keyDown(textarea(), { key: "Enter" });

    expect(onSendText).toHaveBeenCalledOnce();
  });

  it("inserts a newline instead of sending on Shift+Enter", () => {
    const { onSendText } = setup({ text: "hi" });

    fireEvent.keyDown(textarea(), { key: "Enter", shiftKey: true });

    expect(onSendText).not.toHaveBeenCalled();
  });

  it("ignores other keys", () => {
    const { onSendText } = setup({ text: "hi" });

    fireEvent.keyDown(textarea(), { key: "a" });

    expect(onSendText).not.toHaveBeenCalled();
  });

  it("sends when the send button is clicked", () => {
    const { onSendText } = setup({ text: "hi" });

    fireEvent.click(sendButton());

    expect(onSendText).toHaveBeenCalledOnce();
  });

  it("disables the send button when the text is empty", () => {
    setup({ text: "" });
    expect(sendButton()).toBeDisabled();
  });

  it("disables the send button for whitespace-only text", () => {
    setup({ text: "   " });
    expect(sendButton()).toBeDisabled();
  });

  it("disables the send button while a send is in flight", () => {
    setup({ text: "hi", sending: true });
    expect(sendButton()).toBeDisabled();
  });

  it("requests the current location", () => {
    const { onSendLocation } = setup();

    fireEvent.click(screen.getByTitle("現在地を送る"));

    expect(onSendLocation).toHaveBeenCalledOnce();
  });

  it("disables the tool buttons while a send is in flight", () => {
    setup({ sending: true });

    expect(screen.getByTitle("画像を送る")).toBeDisabled();
    expect(screen.getByTitle("現在地を送る")).toBeDisabled();
  });

  it("passes a chosen image to the parent", () => {
    const { onSendImage } = setup();
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    expect(onSendImage).toHaveBeenCalledWith(file);
  });

  it("resets the file input so the same image can be picked again", () => {
    setup();
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    expect(input.value).toBe("");
  });

  it("does nothing when the file picker is dismissed", () => {
    const { onSendImage } = setup();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [] } });

    expect(onSendImage).not.toHaveBeenCalled();
  });

  it("accepts only the supported image types", () => {
    setup();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    expect(input.accept).toBe("image/jpeg,image/png,image/webp");
  });
});
