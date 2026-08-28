import { z } from "zod";

export const signupSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  displayName: z.string().trim().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

const tagInputSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    displayName: z.string().trim().min(1).optional(),
    category: z.string().trim().optional(),
  })
  .refine((t) => Boolean(t.name || t.displayName), {
    message: "tag name or displayName is required",
  });

const locationSchema = z
  .object({
    lat: z.number(),
    lon: z.number().optional(),
    lng: z.number().optional(),
    name: z.string().optional(),
  })
  .refine((l) => l.lon !== undefined || l.lng !== undefined, {
    message: "lon or lng is required",
  })
  .transform((l) => ({
    lat: l.lat,
    lon: l.lon ?? l.lng!,
    ...(l.name ? { name: l.name } : {}),
  }));

export const createCardSchema = z.object({
  type: z.enum(["GIVE", "WANT", "COMPANION"]),
  title: z.string().trim().min(1).max(200),
  note: z.string().max(2000).optional(),
  minMatchCount: z.number().int().min(1).max(50).optional(),
  tags: z.array(tagInputSchema).min(1),
  requiredTags: z.array(z.union([z.string(), z.object({ name: z.string() })])).optional(),
  dates: z.array(z.string()).optional(),
  location: locationSchema.optional(),
});

export function validationErrorResponse(error: z.ZodError) {
  const first = error.issues[0];
  return {
    error: first?.message ?? "Validation failed",
    details: error.flatten(),
  };
}
