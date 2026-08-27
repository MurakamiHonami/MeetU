"""タグの正規化と登録。

条件はすべてタグで表現する。ユーザーは既存タグを選ぶか、その場で新しく作れる。
「プロセカ」「ﾌﾟﾛｾｶ」「ＰＲＯＳＥＫＡ」のような表記ゆれは正規化で 1 つに寄せる。
"""

import re
import unicodedata

from common import ApiError

MAX_TAGS = 10           # 1 カードあたりのタグ上限（候補抽出の Query 回数を抑える）
MAX_TAG_LEN = 30

CATEGORIES = ("work", "character", "item", "event", "area", "trade", "other")

# 正規化で落とす記号。語の区切りとして使われるだけで意味を持たない
_STRIP = re.compile(r"[\s　!-/:-@\[-`{-~！-／：-＠［-｀｛-～、。・「」『』…ー―－‐]")


def normalize(raw):
    """タグ ID を作る。表記ゆれを吸収するのが目的。"""
    if not isinstance(raw, str):
        raise ApiError(400, "タグは文字列で指定してください", "invalid_tag")
    # NFKC で全角英数・半角カナを統一 → 小文字化 → 記号と空白を除去
    text = unicodedata.normalize("NFKC", raw).casefold()
    text = _STRIP.sub("", text)
    if not text:
        raise ApiError(400, f"タグ「{raw}」は記号のみで登録できません", "invalid_tag")
    if len(text) > MAX_TAG_LEN:
        raise ApiError(400, f"タグは{MAX_TAG_LEN}文字以内にしてください", "tag_too_long")
    return text


def parse(raw_tags, field="tags", max_count=None):
    """入力を [{tagId, displayName, category}] に整える。重複は先勝ちで除く。

    入力は文字列か {"name": "...", "category": "..."} のどちらでも受ける。
    """
    if raw_tags is None:
        return []
    if not isinstance(raw_tags, list):
        raise ApiError(400, f"{field} は配列で指定してください", "invalid_tags")
    limit = max_count or MAX_TAGS
    if len(raw_tags) > limit:
        raise ApiError(400, f"タグは{limit}個までです", "too_many_tags")

    out, seen = [], set()
    for entry in raw_tags:
        if isinstance(entry, dict):
            display = (entry.get("name") or entry.get("displayName") or "").strip()
            category = entry.get("category") or "other"
        else:
            display = str(entry).strip()
            category = "other"
        if category not in CATEGORIES:
            category = "other"
        if not display:
            continue

        tag_id = normalize(display)
        if tag_id in seen:
            continue
        seen.add(tag_id)
        out.append({"tagId": tag_id, "displayName": display, "category": category})
    return out


def register(parsed, db):
    """タグマスタに反映（無ければ作成、あれば使用回数 +1）して tagId の配列を返す。"""
    for tag in parsed:
        db.upsert_tag(tag["tagId"], tag["displayName"], tag["category"])
    return [t["tagId"] for t in parsed]


def display_map(tag_ids, db):
    """tagId -> 表示名。マスタに無ければ tagId をそのまま使う。"""
    out = {}
    for tag_id in tag_ids:
        master = db.get_tag(tag_id)
        out[tag_id] = (master or {}).get("displayName") or tag_id
    return out
