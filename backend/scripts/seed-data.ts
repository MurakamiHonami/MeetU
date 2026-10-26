export interface SeedUser {
  email: string;
  displayName: string;
  favorites?: string[];
  home?: { lat: number; lon: number; name: string };
  cards: SeedCard[];
}

export interface SeedCard {
  type: "GIVE" | "WANT" | "COMPANION";
  title: string;
  note?: string;
  minMatchCount?: number;
  tags: string[];
  location?: { lat: number; lon: number; name: string };
}

/** デモ用ユーザーとカード。メールは @meetu.local ドメインで本番と区別しやすくする。 */
export const SEED_USERS: SeedUser[] = [
  {
    email: "seed-yuki@meetu.local",
    displayName: "ゆき",
    favorites: ["TypeScript", "リーダブルコード"],
    home: { lat: 35.6595, lon: 139.7006, name: "渋谷" },
    cards: [
      {
        type: "GIVE",
        title: "リーダブルコード 譲ります",
        note: "美品です。渋谷駅周辺で手渡し希望。",
        tags: ["リーダブルコード", "プログラミング", "オライリー"],
        location: { lat: 35.6595, lon: 139.7006, name: "渋谷駅" },
      },
      {
        type: "WANT",
        title: "達人プログラマー 探してます",
        tags: ["達人プログラマー", "プログラミング"],
      },
    ],
  },
  {
    email: "seed-hana@meetu.local",
    displayName: "はな",
    favorites: ["Go", "インフラ"],
    home: { lat: 35.6896, lon: 139.7006, name: "新宿" },
    cards: [
      {
        type: "GIVE",
        title: "プログラミング言語Go 譲ります",
        note: "書き込みなし。Go 関連の本と交換歓迎。",
        tags: ["Go", "プログラミング", "オライリー"],
        location: { lat: 35.6896, lon: 139.7006, name: "新宿駅" },
      },
      {
        type: "COMPANION",
        title: "SICP 輪読メンバー募集",
        note: "来月からオンラインで週1ペース。初学者歓迎。",
        minMatchCount: 1,
        tags: ["SICP", "輪読", "読書仲間"],
      },
    ],
  },
  {
    email: "seed-ren@meetu.local",
    displayName: "れん",
    favorites: ["リーダブルコード", "設計"],
    home: { lat: 35.7295, lon: 139.7109, name: "池袋" },
    cards: [
      {
        type: "WANT",
        title: "リーダブルコード 求む",
        tags: ["リーダブルコード", "プログラミング", "オライリー"],
        location: { lat: 35.7295, lon: 139.7109, name: "池袋駅" },
      },
      {
        type: "GIVE",
        title: "Clean Architecture 譲ります",
        tags: ["Clean Architecture", "設計"],
      },
    ],
  },
  {
    email: "seed-mio@meetu.local",
    displayName: "みお",
    favorites: ["機械学習", "Python"],
    home: { lat: 35.6984, lon: 139.7731, name: "秋葉原" },
    cards: [
      {
        type: "GIVE",
        title: "ゼロから作るDeep Learning 譲ります",
        tags: ["ゼロから作るDeep Learning", "機械学習", "Python"],
        location: { lat: 35.6984, lon: 139.7731, name: "秋葉原駅" },
      },
      {
        type: "WANT",
        title: "機械学習の本 求む",
        tags: ["機械学習", "Python"],
      },
    ],
  },
  {
    email: "seed-sota@meetu.local",
    displayName: "そうた",
    favorites: ["達人プログラマー", "設計"],
    home: { lat: 35.6812, lon: 139.7671, name: "東京駅" },
    cards: [
      {
        type: "GIVE",
        title: "達人プログラマー 譲ります",
        tags: ["達人プログラマー", "プログラミング", "設計"],
        location: { lat: 35.6812, lon: 139.7671, name: "東京駅" },
      },
      {
        type: "WANT",
        title: "Clean Architecture 探してます",
        tags: ["Clean Architecture", "設計"],
      },
      {
        type: "COMPANION",
        title: "設計本の輪読仲間募集",
        minMatchCount: 1,
        tags: ["設計", "輪読", "読書仲間"],
      },
    ],
  },
];
