import { Context } from "hono";
import { z } from "zod";
import { parseBody } from "./parseBody";
import { validationErrorResponse } from "./schemas";

export async function readJsonBody(
  c: Context,
): Promise<{ ok: true; data: unknown } | { ok: false; response: Response }> {
  try {
    return { ok: true, data: await c.req.json() };
  } catch {
    return { ok: false, response: c.json({ error: "Invalid JSON body" }, 400) };
  }
}

export function parseJson<T>(
  c: Context,
  schema: z.ZodType<T>,
  body: unknown,
): { ok: true; data: T } | { ok: false; response: Response } {
  const parsed = parseBody(schema, body);
  if (!parsed.ok) {
    return { ok: false, response: c.json(validationErrorResponse(parsed.error), 400) };
  }
  return { ok: true, data: parsed.data };
}

export function queryRecord(c: Context): Record<string, string | undefined> {
  const url = new URL(c.req.url);
  const result: Record<string, string | undefined> = {};
  url.searchParams.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

export function parseQueryParams<T>(
  c: Context,
  schema: z.ZodType<T>,
): { ok: true; data: T } | { ok: false; response: Response } {
  const parsed = parseBody(schema, queryRecord(c));
  if (!parsed.ok) {
    return { ok: false, response: c.json(validationErrorResponse(parsed.error), 400) };
  }
  return { ok: true, data: parsed.data };
}
