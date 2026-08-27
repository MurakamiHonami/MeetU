"""ホームのスワイプ用フィードと、保存・見送りの記録。

新着カードをおすすめ順に並べて 1 枚ずつ見せる。右で保存、左で見送り。
一度スワイプしたカードは二度出さない。
"""

import db
import recommend
from common import ApiError, response
from handlers.cards import card_view

FEED_LIMIT = 30
FEED_DAYS = 7


def _visible(card, user_id, owners):
    """フィードに出してよいカードか。"""
    if card.get("status") != "OPEN":
        return False
    if card.get("ownerId") == user_id:
        return False

    owner_id = card["ownerId"]
    if owner_id not in owners:
        owners[owner_id] = db.get_user(owner_id)
    return not db.is_blocked(owners[owner_id])


def list_(ctx):
    """おすすめ順の新着カード。"""
    user = db.ensure_user(ctx["user"])
    user_id = user["userId"]

    done = db.swiped_card_ids(user_id)
    owners = {}
    candidates = [
        card for card in db.feed_cards(days=FEED_DAYS)
        if card.get("cardId") not in done and _visible(card, user_id, owners)
    ]

    ranked = recommend.rank(candidates, user_id, db, user=user, limit=FEED_LIMIT)

    cards = []
    for row in ranked:
        card = row["card"]
        labels = card.get("tagLabels") or {}
        view = card_view(card, db.public_user(owners.get(card["ownerId"])))
        view["score"] = row["score"]
        # なぜ薦めたかを言葉で見せる
        view["reasonTags"] = [labels.get(t, t) for t in row["reasonTags"]]
        cards.append(view)

    return response(200, {
        "cards": cards,
        "personalized": bool(user.get("favoriteTags")) or len(cards) > 0,
        "hasFavorites": bool(user.get("favoriteTags")),
    })


def swipe(ctx, card_id, action):
    """save / skip を記録する。"""
    user_id = ctx["user"]["userId"]
    card = db.get_card(card_id)
    if not card:
        raise ApiError(404, "カードが見つかりません", "not_found")
    if card["ownerId"] == user_id:
        raise ApiError(400, "自分のカードは操作できません", "own_card")

    db.put_swipe(user_id, card_id, action)
    return response(200, {"cardId": card_id, "action": action})


def save(ctx, card_id):
    return swipe(ctx, card_id, "save")


def skip(ctx, card_id):
    return swipe(ctx, card_id, "skip")


def list_saved(ctx):
    user_id = ctx["user"]["userId"]
    owners = {}
    cards = []
    for card in db.list_saved(user_id):
        owner_id = card["ownerId"]
        if owner_id not in owners:
            owners[owner_id] = db.get_user(owner_id)
        cards.append(card_view(card, db.public_user(owners[owner_id])))
    return response(200, {"cards": cards})


def unsave(ctx, card_id):
    db.remove_saved(ctx["user"]["userId"], card_id)
    return response(200, {"cardId": card_id})
