"""マッチの一覧・承諾・辞退・取引完了。

連絡先はアプリ側で保持しない。双方が承諾したらアプリ内のトークでやり取りしてもらう。
"""

import db
import notify
from common import ApiError, response
from handlers.cards import card_view

STATUS_LABEL = {
    "NEW": "新着",
    "ACCEPTED": "やり取り中",
    "DECLINED": "辞退",
    "COMPLETED": "取引完了",
}


def _sides(match, user_id):
    """自分のカードと相手のカードを判定して返す。"""
    if user_id == match["userAId"]:
        return match["cardAId"], match["cardBId"], match["userBId"]
    if user_id == match["userBId"]:
        return match["cardBId"], match["cardAId"], match["userAId"]
    raise ApiError(403, "このマッチの当事者ではありません", "forbidden")


def _view(match, user_id, cards=None, users=None):
    cards = cards if cards is not None else {}
    users = users if users is not None else {}
    my_card_id, their_card_id, partner_id = _sides(match, user_id)

    for card_id in (my_card_id, their_card_id):
        if card_id not in cards:
            cards[card_id] = db.get_card(card_id)
    if partner_id not in users:
        users[partner_id] = db.get_user(partner_id)

    accepted_field = "acceptedA" if user_id == match["userAId"] else "acceptedB"
    partner_field = "acceptedB" if accepted_field == "acceptedA" else "acceptedA"

    their_card = cards.get(their_card_id)
    my_card = cards.get(my_card_id)
    # cardA/cardB はそれぞれが「渡すカード」。相手が渡すものが自分の受け取り
    return {
        "matchId": match["matchId"],
        "status": match.get("status"),
        "statusLabel": STATUS_LABEL.get(match.get("status"), match.get("status")),
        "matchCount": int(match.get("matchCount") or 0),
        "distanceLabel": match.get("distanceLabel"),
        "matchedTags": list(match.get("matchedLabels") or match.get("matchedTags") or []),
        "createdAt": match.get("createdAt"),
        "acceptedByMe": bool(match.get(accepted_field)),
        "acceptedByPartner": bool(match.get(partner_field)),
        "canChat": match.get("status") in ("ACCEPTED", "COMPLETED"),
        "lastMessagePreview": match.get("lastMessagePreview"),
        "lastMessageAt": match.get("lastMessageAt"),
        # 相手の発言が自分の既読より新しければ未読
        "hasUnread": bool(
            match.get("lastMessageAt")
            and match.get("lastMessageBy") != user_id
            and str(match.get("lastMessageAt")) > str(match.get("myLastReadAt") or "")
        ),
        "partner": db.public_user(users.get(partner_id)),
        "partnerCard": card_view(their_card) if their_card else None,
        "myCard": card_view(my_card) if my_card else None,
        # 何を渡して何を受け取るかを明示する
        "iGive": card_view(my_card) if my_card else None,
        "iReceive": card_view(their_card) if their_card else None,
    }


def list_all(ctx):
    user_id = ctx["user"]["userId"]
    cards, users = {}, {}
    matches = db.list_matches(user_id)
    return response(200, {
        "matches": [_view(m, user_id, cards, users) for m in matches],
    })


def get_one(ctx, match_id):
    user_id = ctx["user"]["userId"]
    match = db.get_match(match_id)
    if not match:
        raise ApiError(404, "マッチが見つかりません", "not_found")
    return response(200, {"match": _view(match, user_id)})


def accept(ctx, match_id):
    user_id = ctx["user"]["userId"]
    match, both = db.accept_match(match_id, user_id)
    _, _, partner_id = _sides(match, user_id)
    # 通知に出すのは「受け取る側から見た自分のカード」
    partner_card_id, _, _ = _sides(match, partner_id)
    partner_card = db.get_card(partner_card_id)
    me = db.get_user(user_id)
    name = (me or {}).get("displayName") or "相手"

    if both:
        # 双方合意。ここからアプリ内のトークでやり取りできる
        for uid in (match["userAId"], match["userBId"]):
            notify.push_card(
                uid,
                header="交換が決まりました！",
                title="お互いに「話したい」を送りました",
                lines=[
                    "トーク画面で受け渡しを相談できます。",
                    "金銭のやり取りはせず、物々交換でお願いします。",
                ],
                button="トークを開く",
                uri=notify.liff_url(f"/matches/{match_id}/chat"),
                color=notify.TEAL,
            )
    else:
        notify.push_card(
            partner_id,
            header="「話したい」が届きました",
            title=f"{name} さんがあなたのカードに反応しました",
            lines=[
                f"相手のカード: {(partner_card or {}).get('title') or '-'}",
                "あなたも「話したい」を返すとトークを始められます。",
            ],
            button="内容を見る",
            uri=notify.liff_url(f"/matches/{match_id}"),
            color=notify.PINK,
        )

    return response(200, {"match": _view(match, user_id), "bothAccepted": both})


def decline(ctx, match_id):
    user_id = ctx["user"]["userId"]
    match = db.update_match_status(match_id, "DECLINED", user_id)
    return response(200, {"match": _view(match, user_id)})


def complete(ctx, match_id):
    """取引完了。これを踏んだマッチだけ評価できる。"""
    user_id = ctx["user"]["userId"]
    match = db.get_match(match_id)
    if not match:
        raise ApiError(404, "マッチが見つかりません", "not_found")
    if match.get("status") not in ("ACCEPTED", "COMPLETED"):
        raise ApiError(409, "双方が承諾したマッチのみ完了にできます", "not_accepted")

    match = db.update_match_status(match_id, "COMPLETED", user_id)
    _, _, partner_id = _sides(match, user_id)
    notify.push_card(
        partner_id,
        header="取引が完了しました",
        title="相手の評価をお願いします",
        lines=["評価は、次の相手が安心して取引するための材料になります。"],
        button="評価する",
        uri=notify.liff_url(f"/matches/{match_id}"),
        color=notify.GOLD,
    )
    return response(200, {"match": _view(match, user_id)})
