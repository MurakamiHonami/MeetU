import { client, unwrap } from "../../shared/api";
import type { Tag } from "../../entities/tag/model";

export const tagApi = {
  suggestTags: async (q: string) => {
    const res = await client.api.tags.$get({ query: { q } });
    return unwrap<{ tags: Tag[]; createCandidate?: Tag & { isNew: boolean } }>(res);
  },
};
