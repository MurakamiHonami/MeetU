import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const signup = vi.fn();
const navigate = vi.fn();

vi.mock("../../features/auth/api", () => ({ signup: (...a: unknown[]) => signup(...a) }));
vi.mock("../../shared/lib/navigation", () => ({
  useNavigate: () => navigate,
  useQueryParam: () => null,
}));

import { SignupForm } from "./SignupForm";

function setup() {
  render(<SignupForm />);
}

const nameInput = () => screen.getByPlaceholderText("例: たかし@推し活中");
const emailInput = () => screen.getByPlaceholderText("example@meetu.staging.ruxel.net");
const passwordInput = () => screen.getByPlaceholderText("8文字以上推奨");
const submit = () => screen.getByRole("button", { name: /会員登録|登録中/ });

function fill() {
  fireEvent.change(nameInput(), { target: { value: "たかし" } });
  fireEvent.change(emailInput(), { target: { value: "a@example.com" } });
  fireEvent.change(passwordInput(), { target: { value: "pw12345678" } });
}

beforeEach(() => {
  vi.clearAllMocks();
  signup.mockResolvedValue({ user: {}, tokens: {} });
});

describe("SignupForm", () => {
  it("renders the three registration fields", () => {
    setup();

    expect(nameInput()).toBeInTheDocument();
    expect(emailInput()).toHaveAttribute("type", "email");
    expect(passwordInput()).toHaveAttribute("type", "password");
  });

  it("links to the login page", () => {
    setup();
    expect(screen.getByRole("link", { name: "ログイン" })).toHaveAttribute("href", "/login");
  });

  it("submits all three fields", async () => {
    setup();
    fill();

    fireEvent.click(submit());

    await waitFor(() =>
      expect(signup).toHaveBeenCalledWith({
        email: "a@example.com",
        password: "pw12345678",
        displayName: "たかし",
      }),
    );
  });

  it("navigates home after a successful signup", async () => {
    setup();
    fill();

    fireEvent.click(submit());

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
  });

  it("requires every field", async () => {
    setup();
    fireEvent.change(nameInput(), { target: { value: "たかし" } });

    fireEvent.submit(nameInput().closest("form")!);

    expect(await screen.findByText("すべての項目を入力してください")).toBeInTheDocument();
    expect(signup).not.toHaveBeenCalled();
  });

  it("requires the display name, not just the credentials", async () => {
    setup();
    fireEvent.change(emailInput(), { target: { value: "a@example.com" } });
    fireEvent.change(passwordInput(), { target: { value: "pw12345678" } });

    fireEvent.submit(emailInput().closest("form")!);

    expect(await screen.findByText("すべての項目を入力してください")).toBeInTheDocument();
    expect(signup).not.toHaveBeenCalled();
  });

  it("shows the server error message when signup fails", async () => {
    signup.mockRejectedValue(new Error("既に登録されています"));
    setup();
    fill();

    fireEvent.click(submit());

    expect(await screen.findByText("既に登録されています")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("falls back to a generic message when the error has none", async () => {
    signup.mockRejectedValue(new Error(""));
    setup();
    fill();

    fireEvent.click(submit());

    expect(await screen.findByText("会員登録に失敗しました")).toBeInTheDocument();
  });

  it("disables the button and shows progress while submitting", async () => {
    let release!: () => void;
    signup.mockReturnValue(new Promise<void>((r) => (release = r)));
    setup();
    fill();

    fireEvent.click(submit());

    expect(await screen.findByRole("button", { name: "登録中..." })).toBeDisabled();
    release();
  });

  it("re-enables the button after a failure so the user can retry", async () => {
    signup.mockRejectedValue(new Error("既に登録されています"));
    setup();
    fill();

    fireEvent.click(submit());

    await screen.findByText("既に登録されています");
    expect(submit()).not.toBeDisabled();
  });
});
