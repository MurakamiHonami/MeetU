import { TagNormalizer } from "./TagNormalizer";

export interface TagProps {
  id: string;
  displayName: string;
  category: string;
  useCount: number;
}

export class Tag {
  constructor(private props: TagProps) {}

  get id(): string {
    return this.props.id;
  }
  get displayName(): string {
    return this.props.displayName;
  }
  get category(): string {
    return this.props.category;
  }
  get useCount(): number {
    return this.props.useCount;
  }

  incrementUseCount(): void {
    this.props.useCount += 1;
  }

  toProps(): TagProps {
    return { ...this.props };
  }

  static create(displayName: string, category: string = "other"): Tag {
    const id = TagNormalizer.normalize(displayName);
    return new Tag({
      id,
      displayName,
      category,
      useCount: 1,
    });
  }
}

/**
 * 1 枚のカードに付けられるタグの上限。
 *
 * 目的は 2 つ。
 * 1. 候補評価の量を抑える。候補抽出（ICardRepository.findCardTagHits）は
 *    タグ ID の IN 句で引くため、タグが増えるほどヒット行が増え、後段で
 *    MatchingEngine.satisfies を評価する対象も比例して増える。
 * 2. タグを盛って露出を上げる行為を防ぐ。上限が無いと、無関係なタグを大量に
 *    付けたカードほど検索とマッチの両方に引っかかりやすくなり、公平でなくなる。
 *
 * 10 という値そのものに理論的な裏付けはなく、運用上の初期値である。
 * 画像からの推定は TagVisionService.MAX_TAGS(=8) までしか返さないので、
 * 推定結果に手動で 2 つ足せる余地を残す、という目安で決めている。
 * 実データの分布を見て調整する前提のため、変更はこの定数 1 箇所で完結させる。
 */
export const MAX_TAGS_PER_CARD = 10;
