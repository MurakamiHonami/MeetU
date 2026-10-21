import { ITagRepository } from "../domain/tag/ITagRepository";
import { TagNormalizer } from "../domain/tag/TagNormalizer";
import { ValidationError } from "../domain/shared/DomainError";
import { TagVisionService } from "../infrastructure/ai/TagVisionService";

export type InferredTagView = {
  tagId: string;
  name: string;
  category: string;
  useCount: number;
  isNew: boolean;
};

export class TagInferUseCase {
  constructor(
    private tagRepo: ITagRepository,
    private vision?: TagVisionService,
  ) {}

  async inferFromImage(
    bytes: Uint8Array,
    contentType: string,
  ): Promise<{ tags: InferredTagView[]; titleHint?: string }> {
    if (!this.vision) {
      throw new ValidationError("画像タグ推測は現在利用できません（AI 未設定）");
    }

    const result = await this.vision.inferFromImage(bytes, contentType);
    const candidates = result.tags.map((candidate) => ({
      tagId: TagNormalizer.normalize(candidate.name),
      candidate,
    }));

    const existingTags = await this.tagRepo.findByIds(candidates.map((c) => c.tagId));
    const existingById = new Map(existingTags.map((tag) => [tag.id, tag]));

    const tags: InferredTagView[] = candidates.map(({ tagId, candidate }) => {
      const existing = existingById.get(tagId);
      return {
        tagId,
        name: existing?.displayName ?? candidate.name.trim(),
        category: existing?.category ?? candidate.category,
        useCount: existing?.useCount ?? 0,
        isNew: !existing,
      };
    });

    return { tags, titleHint: result.titleHint };
  }
}
