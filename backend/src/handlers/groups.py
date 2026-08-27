"""環状交換のグループ。

1 対 1 では成立しない組み合わせを、3〜4 人の輪にして成立させる。
全員が承諾して初めて成立し、1 人でも抜けたら輪が閉じないので解散する。
"""

import cycles
import db
import notify
from common import ApiError, new_id, now_iso, response
from handlers.cards import card_view
from handlers.messages import view_message

CHATTABLE = ("ACCEPTED", "COMPLETED")
MAX_TEXT = 1000
STATUS_LABEL = {
    "NEW": "提案中",
    "ACCEPTED": "成立",
    "DECLINED": "解散",
    "COMPLETED": "交換完了",
}


def build(cycle, start_user_id):
    """探索結果をグループの保存形式にする。"""
    steps = cycle["steps"]
    return {
        "groupId": cycle["groupId"],
        "length": cycle["length"],
        "steps": steps,
        "members": [step["fromUserId"] for step in steps],
        "foundBy": start_user_id,
        "responses": {},
        "status": "NEW",
        "createdAt": now_iso(),
    }


def _require_member(group_id, user_id):
    group = db.get_group(group_id)
    if not group:
        raise ApiError(404, "グループが見つかりません", "not_found")
    if user_id not in group["members"]:
        raise ApiError(403, "このグループの参加者ではありません", "forbidden")
    return group


def view(group, user_id, users=None, cards=None):
    """自分視点の説明を付けて返す。"""
    users = users if users is not None else {}
    cards = cards if cards is not None else {}

    def user_of(uid):
        if uid not in users:
            users[uid] = db.get_user(uid)
        return db.public_user(users[uid])

    def card_of(cid):
        if cid not in cards:
            cards[cid] = db.get_card(cid)
        return cards[cid]

    steps = []
    for step in group["steps"]:
        give = card_of(step["giveCardId"])
        steps.append({
            "from": user_of(step["fromUserId"]),
            "to": user_of(step["toUserId"]),
            "card": card_view(give) if give else None,
            "matchedTags": list(step.get("matchedLabels") or []),
            "isMine": step["fromUserId"] == user_id,
        })

    mine = cycles.describe(group["steps"], user_id)
    responses = group.get("responses") or {}

    return {
        "groupId": group["groupId"],
        "length": int(group["length"]),
        "status": group.get("status"),
        "statusLabel": STATUS_LABEL.get(group.get("status"), group.get("status")),
        "createdAt": group.get("createdAt"),
        "steps": steps,
        "members": [user_of(m) for m in group["members"]],
        "myAnswer": responses.get(user_id),
        "acceptedCount": sum(1 for a in responses.values() if a == "accept"),
        # 自分が誰に渡し、誰から受け取るか
        "iGive": (
            card_view(card_of(mine["gives"]["giveCardId"]))
            if mine["gives"] and card_of(mine["gives"]["giveCardId"]) else None
        ),
        "iGiveTo": user_of(mine["gives"]["toUserId"]) if mine["gives"] else None,
        "iReceive": (
            card_view(card_of(mine["receives"]["giveCardId"]))
            if mine["receives"] and card_of(mine["receives"]["giveCardId"]) else None
        ),
        "iReceiveFrom": user_of(mine["receives"]["fromUserId"]) if mine["receives"] else None,
        "canChat": group.get("status") in CHATTABLE,
        "lastMessagePreview": group.get("lastMessagePreview"),
        "hasUnread": bool(
            group.get("lastMessageAt")
            and group.get("lastMessageBy") != user_id
            and str(group.get("lastMessageAt")) > str(group.get("myLastReadAt") or "")
        ),
    }


# ---------------- エンドポイント ----------------

def list_all(ctx):
    user_id = ctx["user"]["userId"]
    users, cards = {}, {}
    groups = db.list_groups(user_id)
    return response(200, {
        "groups": [view(g, user_id, users, cards) for g in groups],
    })


def get_one(ctx, group_id):
    user_id = ctx["user"]["userId"]
    group = _require_member(group_id, user_id)
    return response(200, {"group": view(group, user_id)})


def accept(ctx, group_id):
    user_id = ctx["user"]["userId"]
    _require_member(group_id, user_id)
    group = db.set_group_response(group_id, user_id, "accept")

    me = db.get_user(user_id)
    name = (me or {}).get("displayName") or "参加者"

    if group["status"] == "ACCEPTED":
        for member in group["members"]:
            notify.push_card(
                member,
                header="交換の輪が成立しました！",
                title=f"{group['length']}人での交換が決まりました",
                lines=[
                    "グループトークで受け渡しの日時と場所を決めましょう。",
                    "全員が 1 つずつ渡して 1 つずつ受け取ります。",
                ],
                button="グループトークを開く",
                uri=notify.liff_url(f"/groups/{group_id}/chat"),
                color=notify.TEAL,
            )
    else:
        waiting = len(group["members"]) - sum(
            1 for a in (group.get("responses") or {}).values() if a == "accept"
        )
        for member in group["members"]:
            if member == user_id:
                continue
            notify.push_card(
                member,
                header="交換の輪に参加者が増えました",
                title=f"{name} さんが参加しました",
                lines=[f"あと {waiting} 人の承諾で成立します。"],
                button="内容を見る",
                uri=notify.liff_url(f"/groups/{group_id}"),
                color=notify.PINK,
            )

    return response(200, {
        "group": view(group, user_id),
        "established": group["status"] == "ACCEPTED",
    })


def decline(ctx, group_id):
    user_id = ctx["user"]["userId"]
    _require_member(group_id, user_id)
    group = db.set_group_response(group_id, user_id, "decline")

    for member in group["members"]:
        if member == user_id:
            continue
        notify.push_card(
            member,
            header="交換の輪が解散しました",
            title="参加者が見送ったため成立しませんでした",
            lines=["輪は 1 人でも欠けると成立しません。別の相手を探してみてください。"],
            button="ほかを探す",
            uri=notify.liff_url("/search"),
            color=notify.GOLD,
        )

    return response(200, {"group": view(group, user_id)})


def complete(ctx, group_id):
    user_id = ctx["user"]["userId"]
    group = _require_member(group_id, user_id)
    if group.get("status") not in ("ACCEPTED", "COMPLETED"):
        raise ApiError(409, "成立したグループのみ完了にできます", "not_accepted")

    group = db.update_group_status(group_id, "COMPLETED")
    for member in group["members"]:
        if member == user_id:
            continue
        notify.push_card(
            member,
            header="交換が完了しました",
            title="参加者の評価をお願いします",
            lines=["評価は、次の相手が安心して取引するための材料になります。"],
            button="評価する",
            uri=notify.liff_url(f"/groups/{group_id}"),
            color=notify.GOLD,
        )
    return response(200, {"group": view(group, user_id)})


# ---------------- グループトーク ----------------

def list_messages(ctx, group_id):
    user_id = ctx["user"]["userId"]
    group = _require_member(group_id, user_id)

    after = ctx["query"].get("after")
    messages = db.list_messages(group_id, after=after)
    db.mark_group_read(group_id, user_id, now_iso())

    senders = {}

    def sender_of(uid):
        if uid not in senders:
            senders[uid] = db.public_user(db.get_user(uid))
        return senders[uid]

    return response(200, {
        "messages": [
            {**view_message(m, user_id), "sender": sender_of(m["senderId"])}
            for m in messages
        ],
        "canSend": group.get("status") in CHATTABLE,
        "status": group.get("status"),
        "members": [sender_of(m) for m in group["members"]],
    })


def send_message(ctx, group_id):
    user_id = ctx["user"]["userId"]
    user = db.ensure_user(ctx["user"])
    if db.is_blocked(user):
        raise ApiError(403, "通報が重なったため現在ご利用いただけません", "suspended")

    group = _require_member(group_id, user_id)
    if group.get("status") not in CHATTABLE:
        raise ApiError(409, "成立したグループのみトークできます", "not_accepted")

    import geo

    body = ctx["body"]
    text = (body.get("text") or "").strip()
    image_key = (body.get("imageKey") or "").strip()
    location = geo.parse_location(body.get("location"))

    if image_key and not image_key.startswith(f"chat/{group_id}/"):
        raise ApiError(403, "この画像は使用できません", "invalid_image")
    if not text and not image_key and not location:
        raise ApiError(400, "メッセージを入力してください", "empty_message")
    if len(text) > MAX_TEXT:
        raise ApiError(400, f"メッセージは{MAX_TEXT}文字以内にしてください", "message_too_long")

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

    message = db.put_message(group_id, payload, thread_prefix="GMATCH")
    db.mark_group_read(group_id, user_id, message["createdAt"])

    name = user.get("displayName") or "参加者"
    if db.claim_group_notify(group_id):
        link = notify.liff_url(f"/groups/{group_id}/chat")
        preview = text[:60] if kind == "text" and text else None
        label = {"image": "画像を送りました", "location": "現在地を送りました"}.get(
            kind, "メッセージを送りました")
        for member in group["members"]:
            if member == user_id:
                continue
            notify.push_card(
                member,
                header=f"グループトーク（{len(group['members'])}人）",
                title=f"{name} さんが{label}",
                lines=[preview] if preview else None,
                button="グループトークを開く", uri=link, color=notify.PINK,
            )

    return response(201, {"message": view_message(message, user_id)})
