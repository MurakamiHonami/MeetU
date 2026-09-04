import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageContent, formatMessageTime } from "./MessageContent";
import type { Message } from "../../entities/message/model";

const base: Message = {
  messageId: "x1",
  text: "こんにちは",
  createdAt: "2026-01-01T09:05:00Z",
  mine: false,
  kind: "text",
};

describe("MessageContent", () => {
  it("renders plain text for a text message", () => {
    render(<MessageContent message={base} />);
    expect(screen.getByText("こんにちは")).toBeInTheDocument();
  });

  it("renders an image linking to the full size", () => {
    render(
      <MessageContent
        message={{ ...base, kind: "image", imageUrl: "https://cdn.example/a.jpg" }}
      />,
    );

    const img = screen.getByAltText("送信された画像");
    expect(img).toHaveAttribute("src", "https://cdn.example/a.jpg");
    expect(img.closest("a")).toHaveAttribute("href", "https://cdn.example/a.jpg");
  });

  it("opens the image in a new tab safely", () => {
    render(
      <MessageContent
        message={{ ...base, kind: "image", imageUrl: "https://cdn.example/a.jpg" }}
      />,
    );

    const link = screen.getByAltText("送信された画像").closest("a")!;
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("falls back to text when an image message has no URL", () => {
    render(<MessageContent message={{ ...base, kind: "image" }} />);
    expect(screen.getByText("こんにちは")).toBeInTheDocument();
  });

  it("renders a location as a Google Maps link", () => {
    render(
      <MessageContent
        message={{ ...base, kind: "location", location: { lat: 35.68, lon: 139.76 } }}
      />,
    );

    expect(screen.getByText("地図で開く").closest("a")).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=35.68,139.76",
    );
  });

  it("labels an unnamed location as 現在地", () => {
    render(
      <MessageContent
        message={{ ...base, kind: "location", location: { lat: 35.68, lon: 139.76 } }}
      />,
    );

    expect(screen.getByText("現在地")).toBeInTheDocument();
  });

  it("uses the location name when one is given", () => {
    render(
      <MessageContent
        message={{
          ...base,
          kind: "location",
          location: { lat: 35.68, lon: 139.76, name: "東京駅" },
        }}
      />,
    );

    expect(screen.getByText("東京駅")).toBeInTheDocument();
  });

  it("falls back to text when a location message has no coordinates", () => {
    render(<MessageContent message={{ ...base, kind: "location" }} />);
    expect(screen.getByText("こんにちは")).toBeInTheDocument();
  });
});

describe("formatMessageTime", () => {
  it("formats as H:MM in local time", () => {
    const d = new Date(2026, 0, 1, 9, 5);
    expect(formatMessageTime(d.toISOString())).toBe("9:05");
  });

  it("zero-pads the minutes", () => {
    const d = new Date(2026, 0, 1, 14, 7);
    expect(formatMessageTime(d.toISOString())).toBe("14:07");
  });

  it("renders midnight as 0:00", () => {
    const d = new Date(2026, 0, 1, 0, 0);
    expect(formatMessageTime(d.toISOString())).toBe("0:00");
  });
});
