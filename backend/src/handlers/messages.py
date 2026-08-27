"""LIFF 内のトーク。

やり取りは双方が承諾したマッチの中だけで行う。誰にでも送れると迷惑行為の温床になるため。
相手が LIFF を開いていないと気づけないので、新着があれば LINE に通知する。
ただし連投のたびに Push すると無料枠を食い潰すので間引く。
"""

import db
import geo
import notify
from handlers.uploads import presign_get
from common import ApiError, new_id, now_iso, response

MAX_TEXT = 1000
LOCATION_COOLDOWN = 30   # 位置情報は即時性が要るので間引きを短く
CHATTABLE = ("ACCEPTED", "COMPLETED")


def _match_for(match_id, user_id):
    match = db.get_match(match_id)
    if not match:
        raise ApiError(404, "マッチが見つかりません", "not_found")
    if user_id not in (match["userAId"], match["userBId"]):
        raise ApiError(403, "このマッチの当事者ではありません", "forbidden")
    return match


def _partner_of(match, user_id):
    return match["userBId"] if user_id == match["userAId"] else match["userAId"]


def view_message(message, user_id):
    view = {
        "messageId": message["messageId"],
        "text": message.get("text"),
        "createdAt": message.get("createdAt"),
        "mine": message.get("senderId") == user_id,
        "kind": message.get("kind") or "text",
    }
    if message.get("imageKey"):
        # バケットは非公開なので、見るたびに期限付きの URL を発行する
        view["imageUrl"] = presign_get(message["imageKey"])
    if message.get("location"):
        view["location"] = geo.location_view(message["location"])
    return view


def list_(ctx, match_id):
    """?after=<messageId> で差分だけ取れる（ポーリング用）。"""
    user_id = ctx["user"]["userId"]
    match = _match_for(match_id, user_id)

    after = ctx["query"].get("after")
    messages = db.list_messages(match_id, after=after)

    # 開いた時点で既読にする
    db.mark_read(match_id, user_id, now_iso())

    partner = db.get_user(_partner_of(match, user_id))
    return response(200, {
        "messages": [view_message(m, user_id) for m in messages],
        "canSend": match.get("status") in CHATTABLE,
        "status": match.get("status"),
        "partner": db.public_user(partner),
    })


def create(ctx, match_id):
    user_id = ctx["user"]["userId"]
    user = db.ensure_user(ctx["user"])
    if db.is_blocked(user):
        raise ApiError(403, "通報が重なったため現在ご利用いただけません", "suspended")

    match = _match_for(match_id, user_id)
    if match.get("status") not in CHATTABLE:
        raise ApiError(409, "双方が承諾するとトークを始められます", "not_accepted")

    body = ctx["body"]
    text = (body.get("text") or "").strip()
    image_key = (body.get("imageKey") or "").strip()
    location = geo.parse_location(body.get("location"))

    if image_key and not image_key.startswith(f"chat/{match_id}/"):
        # 他のトークの画像を貼り付けられないようにする
        raise ApiError(403, "この画像は使用できません", "invalid_image")

    if not text and not image_key and not location:
        raise ApiError(400, "メッセージを入力してください", "empty_message")
    if len(text) > MAX_TEXT:
        raise ApiError(400, f"メッセージは{MAX_TEXT}文字以内にしてください", "message_too_long")

    partner_id = _partner_of(match, user_id)
    partner = db.get_user(partner_id)

    kind = "image" if image_key else ("location" if location else "text")
    payload = {
        "messageId": new_id(),
        "senderId": user_id,
        "text": text,
        "kind": kind,
        "createdAt": now_iso(),
    }
    if image_key:
        payload["imageKey"] = image_key
    if location:
        payload["location"] = location

    message = db.put_message(match_id, payload)
    db.mark_read(match_id, user_id, message["createdAt"])

    # 相手が停止中なら通知しない。連投は間引く
    notified = False
    name = user.get("displayName") or "相手"
    # 現地での合流に使うので、位置情報だけは短い間隔でも届ける
    cooldown = LOCATION_COOLDOWN if kind == "location" else db.NOTIFY_COOLDOWN_SEC

    if not db.is_blocked(partner) and db.claim_message_notify(match_id, cooldown):
        link = notify.liff_url(f"/matches/{match_id}/chat")
        if kind == "location":
            # 地図バブルはそのまま送り、返信への導線をカードで添える
            outgoing = [
                notify.location(
                    f"{name} さんの現在地",
                    float(location["lat"]), float(location["lon"]),
                    location.get("name", ""),
                ),
                notify.action_card(
                    header="現在地が届きました",
                    title=f"{name} さんが現在地を送りました",
                    lines=["合流する場所を確認してください。"],
                    button="トークを開く", uri=link, color=notify.TEAL,
                ),
            ]
        else:
            label = "画像を送りました" if kind == "image" else "メッセージを送りました"
            preview = text[:60] if kind == "text" and text else None
            outgoing = [notify.action_card(
                header="新しいメッセージ",
                title=f"{name} さんが{label}",
                lines=[preview] if preview else None,
                button="トークを開く", uri=link, color=notify.PINK,
            )]
        notified = notify.push(partner_id, outgoing)

    return response(201, {"message": view_message(message, user_id), "notified": notified})
