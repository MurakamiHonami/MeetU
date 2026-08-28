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
    const tags: InferredTagView[] = [];

    for (const candidate of result.tags) {
      const tagId = TagNormalizer.normalize(candidate.name);
      const existing = await this.tagRepo.findById(tagId);
      tags.push({
        tagId,
        name: existing?.displayName ?? candidate.name.trim(),
        category: existing?.category ?? candidate.category,
        useCount: existing?.useCount ?? 0,
        isNew: !existing,
      });
    }

    return { tags, titleHint: result.titleHint };
  }
}
