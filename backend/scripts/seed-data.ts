export const SEED_PASSWORD = 'seedpass123';

export interface SeedUser {
  email: string;
  displayName: string;
  favorites?: string[];
  home?: { lat: number; lon: number; name: string };
  cards: SeedCard[];
}

export interface SeedCard {
  type: 'GIVE' | 'WANT' | 'COMPANION';
  title: string;
  note?: string;
  minMatchCount?: number;
  tags: string[];
  location?: { lat: number; lon: number; name: string };
}

/** デモ用ユーザーとカード。メールは @meetu.local ドメインで本番と区別しやすくする。 */
export const SEED_USERS: SeedUser[] = [
  {
    email: 'seed-yuki@meetu.local',
    displayName: 'ゆき',
    favorites: ['プロセカ', '天馬司'],
    home: { lat: 35.6595, lon: 139.7006, name: '渋谷' },
    cards: [
      {
        type: 'GIVE',
        title: '天馬司 アクスタ譲ります',
        note: '未開封に近い状態です。渋谷駅周辺で手渡し希望。',
        tags: ['プロセカ', '天馬司', 'アクスタ'],
        location: { lat: 35.6595, lon: 139.7006, name: '渋谷駅' },
      },
      {
        type: 'WANT',
        title: '司 缶バッジ求めてます',
        tags: ['プロセカ', '天馬司', '缶バッジ'],
      },
    ],
  },
  {
    email: 'seed-hana@meetu.local',
    displayName: 'はな',
    favorites: ['プロセカ', '草薙寧'],
    home: { lat: 35.6896, lon: 139.7006, name: '新宿' },
    cards: [
      {
        type: 'GIVE',
        title: '寧 トレカ譲ります',
        note: '複数枚あり。寧関連と交換歓迎。',
        tags: ['プロセカ', '草薙寧', 'トレカ'],
        location: { lat: 35.6896, lon: 139.7006, name: '新宿駅' },
      },
      {
        type: 'COMPANION',
        title: 'プロセカライブ同行者募集',
        note: '来月のライブに一緒に行ける方探してます。',
        minMatchCount: 1,
        tags: ['プロセカ', 'ライブ', '同行者求'],
      },
    ],
  },
  {
    email: 'seed-ren@meetu.local',
    displayName: 'れん',
    favorites: ['うたプリ', '一ノ瀬トキヤ'],
    home: { lat: 35.7295, lon: 139.7109, name: '池袋' },
    cards: [
      {
        type: 'WANT',
        title: 'トキヤ アクスタ求',
        tags: ['うたプリ', '一ノ瀬トキヤ', 'アクスタ'],
        location: { lat: 35.7295, lon: 139.7109, name: '池袋駅' },
      },
      {
        type: 'GIVE',
        title: 'うたプリ 缶バッジセット譲',
        tags: ['うたプリ', '缶バッジ'],
      },
    ],
  },
  {
    email: 'seed-mio@meetu.local',
    displayName: 'みお',
    favorites: ['プロセカ', '小豆沢こはね'],
    home: { lat: 35.6984, lon: 139.7731, name: '秋葉原' },
    cards: [
      {
        type: 'GIVE',
        title: 'こはね ぬいぐるみ譲ります',
        tags: ['プロセカ', '小豆沢こはね', 'ぬいぐるみ'],
        location: { lat: 35.6984, lon: 139.7731, name: '秋葉原駅' },
      },
      {
        type: 'WANT',
        title: 'プロセカ ぬいぐるみ求',
        tags: ['プロセカ', 'ぬいぐるみ'],
      },
    ],
  },
  {
    email: 'seed-sota@meetu.local',
    displayName: 'そうた',
    favorites: ['アイナナ', '和泉三月'],
    home: { lat: 35.6812, lon: 139.7671, name: '東京駅' },
    cards: [
      {
        type: 'GIVE',
        title: '三月 アクスタ譲',
        tags: ['アイナナ', '和泉三月', 'アクスタ'],
        location: { lat: 35.6812, lon: 139.7671, name: '東京駅' },
      },
      {
        type: 'WANT',
        title: 'アイナナ 缶バッジ求めてます',
        tags: ['アイナナ', '缶バッジ'],
      },
      {
        type: 'COMPANION',
        title: 'アイナナイベント同行者募集',
        minMatchCount: 1,
        tags: ['アイナナ', 'イベント', '同行者求'],
      },
    ],
  },
];
