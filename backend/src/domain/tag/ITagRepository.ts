import { Tag } from "./Tag";

export interface RelatedTagHit {
  tagId: string;
  hits: number;
}

export interface ITagRepository {
  findById(id: string): Promise<Tag | null>;
  findByIds(ids: string[]): Promise<Tag[]>;
  suggest(query: string, limit?: number): Promise<Tag[]>;
  /** 複数タグぶんの関連タグを1回のクエリでまとめて取得する（タグIDごとに最大 limit 件）。 */
  findRelatedTagsForMany(tagIds: string[], limit?: number): Promise<Map<string, RelatedTagHit[]>>;
  recordCooccurrences(tagIds: string[]): Promise<void>;
  save(tag: Tag): Promise<void>;
  incrementCounts(tagIds: string[]): Promise<void>;
}
