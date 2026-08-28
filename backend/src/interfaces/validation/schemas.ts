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

export const tagInputSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    displayName: z.string().trim().min(1).optional(),
    category: z.string().trim().optional(),
  })
  .refine((t) => Boolean(t.name || t.displayName), {
    message: "tag name or displayName is required",
  });

export const locationSchema = z
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

export const cardsSearchQuerySchema = z.object({
  tags: z.string().optional().default(""),
  minMatch: z.coerce.number().int().min(1).max(50).optional().default(1),
  type: z.enum(["GIVE", "WANT", "COMPANION"]).optional(),
});

export const tagsQuerySchema = z.object({
  q: z.string().optional().default(""),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().finite(),
  lon: z.coerce.number().finite(),
  radius: z.coerce.number().positive().max(50).optional(),
  type: z.enum(["GIVE", "WANT", "COMPANION"]).optional(),
});

export const messagesAfterQuerySchema = z.object({
  after: z.string().optional(),
});

export const updateMeSchema = z.union([
  z.object({
    favorites: z.array(z.object({ name: z.string().trim().min(1).max(100) })),
  }),
  z.object({
    homeLocation: z.union([locationSchema, z.null()]),
  }),
  z.object({
    displayName: z.string().trim().min(1).max(100),
    pictureUrl: z.string().trim().max(500).optional(),
  }),
]);

export const sendMessageSchema = z
  .object({
    text: z.string().trim().max(2000).optional(),
    imageKey: z.string().trim().min(1).optional(),
    location: locationSchema.optional(),
  })
  .refine((body) => Boolean(body.text || body.imageKey || body.location), {
    message: "text, imageKey, or location is required",
  });

export const createReviewSchema = z.object({
  matchId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export const reportReasonSchema = z.enum([
  "NOT_DELIVERED",
  "ITEM_CONDITION",
  "HARASSMENT",
  "FRAUD",
  "NO_SHOW",
  "OTHER",
]);

export const createReportSchema = z.object({
  targetUserId: z.string().min(1),
  matchId: z.string().min(1).optional(),
  reason: reportReasonSchema,
  detail: z.string().max(500).optional(),
});

export const createUploadTicketSchema = z
  .object({
    matchId: z.string().min(1).optional(),
    groupId: z.string().min(1).optional(),
    contentType: z.string().trim().min(1),
    size: z.number().int().positive().optional(),
  })
  .refine((body) => Boolean(body.matchId || body.groupId), {
    message: "matchId or groupId is required",
  });

export function validationErrorResponse(error: z.ZodError) {
  const first = error.issues[0];
  return {
    error: first?.message ?? "Validation failed",
    details: error.flatten(),
  };
}
