/**
 * Live staging API smoke / integration tests.
 * Run: npm run test:staging -w meetu-backend
 * Requires network access to STAGING_API (default: api-meetu-staging.ruxel.net).
 */
import { describe, expect, it } from "vitest";

const STAGING_API = (process.env.STAGING_API ?? "https://api-meetu-staging.ruxel.net").replace(
  /\/$/,
  "",
);

async function request(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown; text: string }> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${STAGING_API}${path}`, { ...init, headers });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // non-JSON body (e.g. "Internal Server Error")
  }
  return { status: res.status, body, text };
}

function assertStatus(actual: number, expected: number, context: string, text: string) {
  expect(actual, `${context}: HTTP ${actual} — ${text}`).toBe(expected);
}

describe(`Staging API (${STAGING_API})`, () => {
  it("GET /health returns 200", async () => {
    const { status, body } = await request("/health");
    assertStatus(status, 200, "GET /health", JSON.stringify(body));
    expect(body).toMatchObject({ status: "ok" });
  });

  it("POST /api/auth/signup → login → GET /api/me", async () => {
    const email = `ci-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@meetu.local`;
    const password = "integration-test-pass1";
    const displayName = "CI Integration";

    const signup = await request("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, displayName }),
    });
    assertStatus(signup.status, 201, "POST /api/auth/signup", signup.text);

    const signupBody = signup.body as {
      tokens?: { accessToken?: string };
      user?: { email?: string };
    };
    expect(signupBody.tokens?.accessToken).toBeTruthy();
    expect(signupBody.user?.email).toBe(email);

    const login = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    assertStatus(login.status, 200, "POST /api/auth/login", login.text);

    const loginBody = login.body as { tokens?: { accessToken?: string } };
    const accessToken = loginBody.tokens?.accessToken;
    expect(accessToken).toBeTruthy();

    const me = await request("/api/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assertStatus(me.status, 200, "GET /api/me", me.text);

    const meBody = me.body as { user?: { displayName?: string } };
    expect(meBody.user?.displayName).toBe(displayName);
  });

  it("POST /api/auth/login rejects unknown user with 401 (not 500)", async () => {
    const login = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: `nobody-${Date.now()}@meetu.local`,
        password: "wrong-password-123",
      }),
    });
    assertStatus(login.status, 401, "POST /api/auth/login unknown user", login.text);
  });

  it("POST /api/auth/signup rejects invalid email with 400 (not 500)", async () => {
    const signup = await request("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        email: "not-an-email",
        password: "password123",
        displayName: "Bad",
      }),
    });
    assertStatus(signup.status, 400, "POST /api/auth/signup invalid email", signup.text);
  });
});
