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

    await this.kv.put(`refresh:${refreshToken}`, JSON.stringify({ userId, email }), {
      expirationTtl: REFRESH_TOKEN_TTL,
    });

    return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL };
  }

  async refreshTokenPair(oldRefreshToken: string): Promise<TokenPair | null> {
    const key = `refresh:${oldRefreshToken}`;
    const stored = await this.kv.get(key);
    if (!stored) return null;

    const { userId, email } = JSON.parse(stored);
    await this.kv.delete(key);
    return this.createTokenPair(userId, email);
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    await this.kv.delete(`refresh:${refreshToken}`);
  }
}
