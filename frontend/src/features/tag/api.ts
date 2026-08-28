import { authenticatedFetch, client, unwrap } from "../../shared/api";
import { API_BASE } from "../../shared/api/config";
import type { Tag } from "../../entities/tag/model";

export type InferredTag = Tag & { isNew: boolean };

export const tagApi = {
  suggestTags: async (q: string) => {
    const res = await client.api.tags.$get({ query: { q } });
    return unwrap<{ tags: Tag[]; createCandidate?: Tag & { isNew: boolean } }>(res);
  },

  inferTagsFromImage: async (file: File) => {
    const form = new FormData();
    form.append("image", file);
    const res = await authenticatedFetch(`${API_BASE}/api/tags/infer-image`, {
      method: "POST",
      body: form,
    });
    return unwrap<{ tags: InferredTag[]; titleHint?: string }>(res);
  },
};
