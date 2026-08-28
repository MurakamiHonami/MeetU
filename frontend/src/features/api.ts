import { cardApi } from "./card/api";
import { feedApi } from "./feed/api";
import { groupApi } from "./group/api";
import { matchApi } from "./match/api";
import { nearbyApi } from "./nearby/api";
import { reviewApi } from "./review/api";
import { tagApi } from "./tag/api";
import { uploadApi } from "./upload/api";
import { userApi } from "./user/api";

/** ページ互換の集約 API（段階的に feature 直 import へ移行可能） */
export const api = {
  ...userApi,
  ...tagApi,
  ...cardApi,
  ...matchApi,
  ...feedApi,
  ...groupApi,
  ...nearbyApi,
  ...uploadApi,
  ...reviewApi,
};
