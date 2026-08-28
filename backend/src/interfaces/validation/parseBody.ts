import { z } from "zod";

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: z.ZodError };

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): ParseResult<T> {
  const result = schema.safeParse(body);
  if (!result.success) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}
