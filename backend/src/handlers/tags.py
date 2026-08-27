"""タグのサジェストと新規作成。

入力欄に打ちながら候補を出し、無ければその場で作れるようにする。
"""

import db
import tags as tagutil
from common import response


def _view(tag):
    return {
        "tagId": tag.get("tagId"),
        "name": tag.get("displayName") or tag.get("tagId"),
        "category": tag.get("category") or "other",
        "useCount": int(tag.get("useCount") or 0),
    }


def suggest(ctx):
    """?q=プロセ で前方一致。q なしなら人気タグ。"""
    query = (ctx["query"].get("q") or "").strip()
    try:
        limit = min(int(ctx["query"].get("limit") or 20), 50)
    except ValueError:
        limit = 20

    prefix = tagutil.normalize(query) if query else ""
    found = db.search_tags(prefix, limit)
    result = {"tags": [_view(t) for t in found]}

    # 候補に無ければ「新しく作る」選択肢を返す。フロントはこれをそのまま出せばよい
    if query and not any(t.get("tagId") == prefix for t in found):
        result["createCandidate"] = {"tagId": prefix, "name": query, "isNew": True}
    return response(200, result)


def create(ctx):
    """明示的なタグ作成。既に同じ正規化結果のタグがあればそれを返す。"""
    parsed = tagutil.parse([{
        "name": ctx["body"].get("name"),
        "category": ctx["body"].get("category"),
    }], field="name")
    if not parsed:
        from common import ApiError
        raise ApiError(400, "タグ名を指定してください", "invalid_tag")

    tag = parsed[0]
    existing = db.get_tag(tag["tagId"])
    if existing:
        return response(200, {"tag": _view(existing), "created": False})

    db.upsert_tag(tag["tagId"], tag["displayName"], tag["category"])
    return response(201, {"tag": {
        "tagId": tag["tagId"], "name": tag["displayName"],
        "category": tag["category"], "useCount": 1,
    }, "created": True})
