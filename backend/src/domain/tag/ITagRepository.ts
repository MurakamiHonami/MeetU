import { Tag } from "./Tag";

export interface RelatedTagHit {
  tagId: string;
  hits: number;
}

export interface ITagRepository {
  findById(id: string): Promise<Tag | null>;
  findByIds(ids: string[]): Promise<Tag[]>;
  suggest(query: string, limit?: number): Promise<Tag[]>;
  findRelatedTags(tagId: string, limit?: number): Promise<RelatedTagHit[]>;
  recordCooccurrences(tagIds: string[]): Promise<void>;
  save(tag: Tag): Promise<void>;
  incrementCounts(tagIds: string[]): Promise<void>;
}
