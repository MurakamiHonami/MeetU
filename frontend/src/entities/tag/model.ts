export type Tag = { tagId: string; name: string; category?: string; useCount?: number };

/**
 * 1 枚のカードに付けられるタグの上限。
 *
 * バックエンドの MAX_TAGS_PER_CARD（backend/src/domain/tag/Tag.ts）と同じ値にする。
 * 上限を超える分はサーバ側の zod バリデーションで弾かれるため、
 * ここでの制限は「弾かれる前に UI 側で止める」ためのもの。
 * 値を変える場合は両方を揃えること。
 */
export const MAX_TAGS_PER_CARD = 10;
