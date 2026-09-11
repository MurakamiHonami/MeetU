import { client, unwrap } from "../../shared/api";

export type ReportReason =
  | "NOT_DELIVERED"
  | "ITEM_CONDITION"
  | "HARASSMENT"
  | "FRAUD"
  | "NO_SHOW"
  | "OTHER";

export const reviewApi = {
  review: async (payload: { matchId: string; rating: number; comment?: string }) => {
    const res = await client.api.reviews.$post({ json: payload });
    return unwrap<{ review: unknown }>(res);
  },

  report: async (payload: {
    targetUserId: string;
    matchId: string;
    reason: ReportReason;
    detail?: string;
  }) => {
    const res = await client.api.reports.$post({ json: payload });
    return unwrap<{ reportId: string; message: string }>(res);
  },
};
