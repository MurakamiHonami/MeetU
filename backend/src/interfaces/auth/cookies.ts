import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Context } from "hono";
import type { Env } from "../middleware/auth";

export const REFRESH_COOKIE = "meetu_refresh";
const REFRESH_MAX_AGE = 45 * 24 * 60 * 60;

function cookieOptions(c: Context<Env>) {
  const isDeployed = c.env.APP_ENV === "production" || c.env.APP_ENV === "staging";
  const domain = c.env.COOKIE_DOMAIN?.trim() || undefined;
  return {
    httpOnly: true,
    secure: isDeployed,
    sameSite: isDeployed ? ("None" as const) : ("Lax" as const),
    path: "/",
    maxAge: REFRESH_MAX_AGE,
    ...(domain ? { domain } : {}),
  };
}

export function setRefreshCookie(c: Context<Env>, refreshToken: string): void {
  setCookie(c, REFRESH_COOKIE, refreshToken, cookieOptions(c));
}

export function clearRefreshCookie(c: Context<Env>): void {
  deleteCookie(c, REFRESH_COOKIE, cookieOptions(c));
}

export function readRefreshToken(c: Context<Env>): string | null {
  return getCookie(c, REFRESH_COOKIE) ?? null;
}
