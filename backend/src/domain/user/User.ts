import { Location, LocationProps } from "../shared/Location";

export type UserStatus = "ACTIVE" | "SUSPENDED";

export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  displayName: string;
  pictureUrl?: string;
  ratingAvg: number;
  ratingCount: number;
  reportCount: number;
  tradeCount: number;
  favoriteTags: string[]; // tagIds
  favoriteLabels?: Record<string, string>;
  homeLocation?: LocationProps;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export class User {
  constructor(private props: UserProps) {}

  get id(): string {
    return this.props.id;
  }
  get email(): string {
    return this.props.email;
  }
  get passwordHash(): string {
    return this.props.passwordHash;
  }
  get salt(): string {
    return this.props.salt;
  }
  get displayName(): string {
    return this.props.displayName;
  }
  get pictureUrl(): string | undefined {
    return this.props.pictureUrl;
  }
  get ratingAvg(): number {
    return this.props.ratingAvg;
  }
  get ratingCount(): number {
    return this.props.ratingCount;
  }
  get reportCount(): number {
    return this.props.reportCount;
  }
  get tradeCount(): number {
    return this.props.tradeCount;
  }
  get favoriteTags(): string[] {
    return [...this.props.favoriteTags];
  }
  get favoriteLabels(): Record<string, string> {
    return { ...this.props.favoriteLabels };
  }
  get homeLocation(): Location | undefined {
    return this.props.homeLocation ? new Location(this.props.homeLocation) : undefined;
  }
  get status(): UserStatus {
    return this.props.status;
  }
  get createdAt(): string {
    return this.props.createdAt;
  }
  get updatedAt(): string {
    return this.props.updatedAt;
  }

  isSuspended(): boolean {
    return this.props.status === "SUSPENDED";
  }

  updateProfile(displayName: string, pictureUrl?: string): void {
    this.props.displayName = displayName;
    if (pictureUrl !== undefined) {
      this.props.pictureUrl = pictureUrl;
    }
    this.props.updatedAt = new Date().toISOString();
  }

  setFavorites(tagIds: string[], labels: Record<string, string>): void {
    this.props.favoriteTags = tagIds;
    this.props.favoriteLabels = labels;
    this.props.updatedAt = new Date().toISOString();
  }

  setHomeLocation(location: Location | undefined): void {
    this.props.homeLocation = location?.toJSON();
    this.props.updatedAt = new Date().toISOString();
  }

  applyReview(rating: number): void {
    const totalScore = this.props.ratingAvg * this.props.ratingCount + rating;
    this.props.ratingCount += 1;
    this.props.ratingAvg = Math.round((totalScore / this.props.ratingCount) * 10) / 10;
    this.props.tradeCount += 1;
    this.props.updatedAt = new Date().toISOString();
  }

  incrementReport(): void {
    this.props.reportCount += 1;
    if (this.props.reportCount >= 3) {
      this.props.status = "SUSPENDED";
    }
    this.props.updatedAt = new Date().toISOString();
  }

  toProps(): UserProps {
    return {
      ...this.props,
      favoriteTags: [...this.props.favoriteTags],
      favoriteLabels: { ...this.props.favoriteLabels },
    };
  }

  toPublicProfile() {
    return {
      id: this.props.id,
      email: this.props.email,
      displayName: this.props.displayName,
      pictureUrl: this.props.pictureUrl,
      ratingAvg: this.props.ratingCount ? this.props.ratingAvg : null,
      ratingCount: this.props.ratingCount,
      tradeCount: this.props.tradeCount,
      isNew: this.props.ratingCount === 0,
      status: this.props.status,
      createdAt: this.props.createdAt,
    };
  }

  static create(
    email: string,
    passwordHash: string,
    salt: string,
    displayName: string,
    pictureUrl?: string,
  ): User {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    return new User({
      id,
      email,
      passwordHash,
      salt,
      displayName,
      pictureUrl,
      ratingAvg: 0.0,
      ratingCount: 0,
      reportCount: 0,
      tradeCount: 0,
      favoriteTags: [] as string[],
      favoriteLabels: {} as Record<string, string>,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });
  }
}
