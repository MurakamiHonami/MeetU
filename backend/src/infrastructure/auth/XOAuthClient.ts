const AUTHORIZATION_ENDPOINT = "https://twitter.com/i/oauth2/authorize";
const TOKEN_ENDPOINT = "https://api.twitter.com/2/oauth2/token";
const USERINFO_ENDPOINT = "https://api.twitter.com/2/users/me?user.fields=profile_image_url";
const SCOPES = "tweet.read users.read";

export interface XOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface XProfile {
  id: string;
  name: string;
  profileImageUrl?: string;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** X (Twitter) の OAuth 2.0 Authorization Code + PKCE フロー（confidential client）。 */
export class XOAuthClient {
  constructor(private config: XOAuthConfig) {}

  static generateState(): string {
    return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
  }

  static generateCodeVerifier(): string {
    return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
  }

  private static async codeChallenge(codeVerifier: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
    return base64UrlEncode(new Uint8Array(digest));
  }

  async createAuthorizationUrl(state: string, codeVerifier: string): Promise<string> {
    const url = new URL(AUTHORIZATION_ENDPOINT);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("redirect_uri", this.config.redirectUri);
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", await XOAuthClient.codeChallenge(codeVerifier));
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }

  /** 失敗時（X 側のエラー・ネットワークエラー）は null を返す。呼び出し側でログインエラー扱いにする。 */
  async exchangeCode(code: string, codeVerifier: string): Promise<string | null> {
    const basicAuth = btoa(`${this.config.clientId}:${this.config.clientSecret}`);
    const res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: this.config.redirectUri,
        code_verifier: codeVerifier,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  }

  /** 失敗時は null を返す。呼び出し側でログインエラー扱いにする。 */
  async fetchProfile(accessToken: string): Promise<XProfile | null> {
    const res = await fetch(USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      data: { id: string; name: string; profile_image_url?: string };
    };
    return { id: data.data.id, name: data.data.name, profileImageUrl: data.data.profile_image_url };
  }
}
