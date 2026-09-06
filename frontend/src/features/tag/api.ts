import { authenticatedFetch, client, unwrap } from "../../shared/api";
import { API_BASE } from "../../shared/api/config";
import type { Tag } from "../../entities/tag/model";

export type InferredTag = Tag & { isNew: boolean };

export const tagApi = {
  suggestTags: async (q: string) => {
    const res = await client.api.tags.$get({ query: { q } });
    return unwrap<{ tags: Tag[]; createCandidate?: Tag & { isNew: boolean } }>(res);
  },

  /**
   * 写真からタグ候補を推定する。
   *
   * 推論に時間がかかるので、写真を差し替えたときに前の要求を打ち切れるよう
   * signal を受け取る。渡さなければ従来どおり中断なしで走る。
   */
  inferTagsFromImage: async (file: File, signal?: AbortSignal) => {
    const form = new FormData();
    form.append("image", file);
    const res = await authenticatedFetch(`${API_BASE}/api/tags/infer-image`, {
      method: "POST",
      body: form,
      signal,
    });
    return unwrap<{ tags: InferredTag[]; titleHint?: string }>(res);
  },
};
