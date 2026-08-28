import type { TokenPair } from '../../infrastructure/auth/AuthService';

/** JSON レスポンス用（refresh token は HttpOnly Cookie のみ） */
export function toPublicTokens(tokens: TokenPair) {
  return {
    accessToken: tokens.accessToken,
    expiresIn: tokens.expiresIn,
  };
}
