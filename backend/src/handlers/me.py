"""自分のプロフィール。ID Token の内容から初回自動作成する。"""

import db
import geo
import tags as tagutil
from common import ApiError, response


def get_me(ctx):
    user = db.ensure_user(ctx["user"])
    if user.get("status") == "SUSPENDED":
        raise ApiError(403, "通報が重なったため現在ご利用いただけません", "suspended")

    profile = db.public_user(user)
    profile["cardCount"] = len(db.list_user_cards(user["userId"]))
    profile["favorites"] = _favorites_view(user)
    profile["homeLocation"] = geo.location_view(user.get("homeLocation"))
    return response(200, {"user": profile})


def _favorites_view(user):
    labels = user.get("favoriteLabels") or {}
    return [
        {"tagId": tag, "name": labels.get(tag, tag)}
        for tag in (user.get("favoriteTags") or [])
    ]


MAX_FAVORITES = 20


def update_me(ctx):
    """好きな作品を登録する。おすすめの並べ替えに使う。

    表示名とアイコンは LINE 側の値を自動で追従させるので、ここでは触らない。
    """
    user = db.ensure_user(ctx["user"])

    if "favorites" in ctx["body"]:
        parsed = tagutil.parse(
            ctx["body"].get("favorites"), field="favorites", max_count=MAX_FAVORITES,
        )
        tag_ids = [t["tagId"] for t in parsed]
        labels = {t["tagId"]: t["displayName"] for t in parsed}
        # サジェストに出したいのでタグマスタにも登録する
        tagutil.register(parsed, db)
        db.set_favorites(user["userId"], tag_ids, labels)
        user["favoriteTags"] = tag_ids
        user["favoriteLabels"] = labels

    # 拠点。カードに位置を付けていなくても、近い相手を優先できるようにする
    if "homeLocation" in ctx["body"]:
        raw = ctx["body"].get("homeLocation")
        home = geo.parse_location(raw) if raw else None
        db.set_home_location(user["userId"], home)
        user["homeLocation"] = home

    profile = db.public_user(user)
    profile["favorites"] = _favorites_view(user)
    profile["homeLocation"] = geo.location_view(user.get("homeLocation"))
    return response(200, {"user": profile})


def my_reviews(ctx):
    user_id = ctx["user"]["userId"]
    reviews = db.list_reviews(user_id)
    return response(200, {"reviews": [
        {
            "rating": int(r.get("rating") or 0),
            "comment": r.get("comment"),
            "createdAt": r.get("createdAt"),
        }
        for r in reviews
    ]})
