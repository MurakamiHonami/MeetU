import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const login = vi.fn();
const navigate = vi.fn();

vi.mock("../../features/auth/api", () => ({ login: (...a: unknown[]) => login(...a) }));
vi.mock("../../shared/lib/navigation", () => ({
  useNavigate: () => navigate,
  useQueryParam: () => null,
}));

import { LoginForm } from "./LoginForm";

function setup() {
  render(<LoginForm />);
}

const emailInput = () => screen.getByPlaceholderText("example@meetu.staging.ruxel.net");
const passwordInput = () => screen.getByPlaceholderText("••••••••");
const submit = () => screen.getByRole("button", { name: /ログイン/ });

function fill(email = "a@example.com", password = "pw12345678") {
  fireEvent.change(emailInput(), { target: { value: email } });
  fireEvent.change(passwordInput(), { target: { value: password } });
}

beforeEach(() => {
  vi.clearAllMocks();
  login.mockResolvedValue({ user: {}, tokens: {} });
});

describe("LoginForm", () => {
  it("renders the email and password fields", () => {
    setup();

    expect(emailInput()).toHaveAttribute("type", "email");
    expect(passwordInput()).toHaveAttribute("type", "password");
  });

  it("links to the signup page", () => {
    setup();
    expect(screen.getByRole("link", { name: "新規会員登録" })).toHaveAttribute("href", "/signup");
  });

  it("shows no error before submitting", () => {
    setup();
    expect(document.querySelector(".auth-error")).toBeNull();
  });

  it("submits the entered credentials", async () => {
    setup();
    fill();

    fireEvent.click(submit());

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({ email: "a@example.com", password: "pw12345678" }),
    );
  });

  it("navigates home after a successful login", async () => {
    setup();
    fill();

    fireEvent.click(submit());

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
  });

  it("validates that both fields are filled", async () => {
    setup();
    fireEvent.change(emailInput(), { target: { value: "a@example.com" } });

    fireEvent.submit(emailInput().closest("form")!);

    expect(
      await screen.findByText("メールアドレスとパスワードを入力してください"),
    ).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("shows the server error message when login fails", async () => {
    login.mockRejectedValue(new Error("認証に失敗しました"));
    setup();
    fill();

    fireEvent.click(submit());

    expect(await screen.findByText("認証に失敗しました")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("falls back to a generic message when the error has none", async () => {
    login.mockRejectedValue(new Error(""));
    setup();
    fill();

    fireEvent.click(submit());

    expect(await screen.findByText("ログインに失敗しました")).toBeInTheDocument();
  });

  it("disables the button and shows progress while submitting", async () => {
    let release!: () => void;
    login.mockReturnValue(new Promise<void>((r) => (release = r)));
    setup();
    fill();

    fireEvent.click(submit());

    expect(await screen.findByRole("button", { name: "ログイン中..." })).toBeDisabled();
    release();
  });

  it("re-enables the button after a failure so the user can retry", async () => {
    login.mockRejectedValue(new Error("認証に失敗しました"));
    setup();
    fill();

    fireEvent.click(submit());

    await screen.findByText("認証に失敗しました");
    expect(submit()).not.toBeDisabled();
  });

  it("clears a previous error when resubmitting", async () => {
    login.mockRejectedValueOnce(new Error("認証に失敗しました"));
    setup();
    fill();

    fireEvent.click(submit());
    await screen.findByText("認証に失敗しました");

    fireEvent.click(submit());

    await waitFor(() => expect(screen.queryByText("認証に失敗しました")).not.toBeInTheDocument());
  });
});
