import { sign, verify } from "hono/jwt";
import bcrypt from "bcryptjs";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JWTPayload {
  userId: string;
  email: string;
  exp: number;
  [key: string]: unknown;
}

const BCRYPT_ROUNDS = 10;
const ACCESS_TOKEN_TTL = 1 * 60 * 60;
const REFRESH_TOKEN_TTL = 45 * 24 * 60 * 60;

export class AuthService {
  constructor(
    private kv: KVNamespace,
    private jwtSecret: string,
  ) {}

  static async hashPassword(password: string, _salt?: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  static generateSalt(): string {
    return bcrypt.genSaltSync(BCRYPT_ROUNDS);
  }

  static async verifyPassword(password: string, _salt: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static async verifyAccessToken(token: string, jwtSecret: string): Promise<JWTPayload | null> {
    try {
      const payload = await verify(token, jwtSecret, "HS256");
      return payload as unknown as JWTPayload;
    } catch {
      return null;
    }
  }

  async createAccessToken(userId: string, email: string): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL;
    return sign({ userId, email, exp }, this.jwtSecret);
  }

  async createTokenPair(userId: string, email: string): Promise<TokenPair> {
    const accessToken = await this.createAccessToken(userId, email);
    const refreshToken = crypto.randomUUID();

    await Promise.all([
      this.kv.put(`refresh:${refreshToken}`, JSON.stringify({ userId, email }), {
        expirationTtl: REFRESH_TOKEN_TTL,
      }),
      this.kv.put(this.refreshIndexKey(userId, refreshToken), "1", {
        expirationTtl: REFRESH_TOKEN_TTL,
      }),
    ]);

    return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL };
  }

  /** リフレッシュトークンを消費・回転せずに、紐づくユーザー情報だけを覗き見る。 */
  async peekRefreshToken(refreshToken: string): Promise<{ userId: string; email: string } | null> {
    const stored = await this.kv.get(`refresh:${refreshToken}`);
    if (!stored) return null;
    return JSON.parse(stored);
  }

  async rotateRefreshToken(
    oldRefreshToken: string,
    userId: string,
    email: string,
  ): Promise<TokenPair> {
    await this.kv.delete(`refresh:${oldRefreshToken}`);
    await this.kv.delete(this.refreshIndexKey(userId, oldRefreshToken));
    return this.createTokenPair(userId, email);
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const key = `refresh:${refreshToken}`;
    const stored = await this.kv.get(key);
    await this.kv.delete(key);
    if (stored) {
      const { userId } = JSON.parse(stored);
      await this.kv.delete(this.refreshIndexKey(userId, refreshToken));
    }
  }

  /** suspend されたユーザーの既存セッションを全て無効化する。 */
  async revokeAllRefreshTokensForUser(userId: string): Promise<void> {
    const prefix = this.refreshIndexKey(userId, "");
    let cursor: string | undefined;
    do {
      const page = await this.kv.list({ prefix, cursor });
      await Promise.all(
        page.keys.map(async ({ name }) => {
          const refreshToken = name.slice(prefix.length);
          await this.kv.delete(`refresh:${refreshToken}`);
          await this.kv.delete(name);
        }),
      );
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  }

  private refreshIndexKey(userId: string, refreshToken: string): string {
    return `refresh_index:${userId}:${refreshToken}`;
  }
}
