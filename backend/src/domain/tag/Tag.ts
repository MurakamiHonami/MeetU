import { TagNormalizer } from './TagNormalizer';

export interface TagProps {
  id: string;
  displayName: string;
  category: string;
  useCount: number;
}

export class Tag {
  constructor(private props: TagProps) {}

  get id(): string { return this.props.id; }
  get displayName(): string { return this.props.displayName; }
  get category(): string { return this.props.category; }
  get useCount(): number { return this.props.useCount; }

  incrementUseCount(): void {
    this.props.useCount += 1;
  }

  toProps(): TagProps {
    return { ...this.props };
  }

  static create(displayName: string, category: string = 'other'): Tag {
    const id = TagNormalizer.normalize(displayName);
    return new Tag({
      id,
      displayName,
      category,
      useCount: 1,
    });
  }
}
