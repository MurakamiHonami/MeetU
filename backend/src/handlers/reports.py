"""通報。一定件数たまったユーザーは自動的に停止し、マッチング対象から外れる。"""

import db
from common import ApiError, new_id, now_iso, response

REASONS = {
    "NOT_DELIVERED": "商品が届かない",
    "ITEM_CONDITION": "商品の状態が説明と違う",
    "HARASSMENT": "迷惑行為・暴言",
    "FRAUD": "詐欺の疑い",
    "NO_SHOW": "当日来なかった",
    "OTHER": "その他",
}

MAX_DETAIL = 500


def create(ctx):
    user_id = ctx["user"]["userId"]
    body = ctx["body"]

    target_id = body.get("targetUserId")
    if not target_id:
        raise ApiError(400, "targetUserId を指定してください", "invalid_request")
    if target_id == user_id:
        raise ApiError(400, "自分自身は通報できません", "invalid_target")

    reason = body.get("reason")
    if reason not in REASONS:
        raise ApiError(400, f"reason は {'/'.join(REASONS)} のいずれかです", "invalid_reason")

    if not db.get_user(target_id):
        raise ApiError(404, "対象のユーザーが見つかりません", "not_found")

    # マッチ経由の通報なら当事者かどうかを確認する
    match_id = body.get("matchId")
    if match_id:
        match = db.get_match(match_id)
        if not match:
            raise ApiError(404, "マッチが見つかりません", "not_found")
        if user_id not in (match["userAId"], match["userBId"]):
            raise ApiError(403, "このマッチの当事者ではありません", "forbidden")

    result = db.put_report({
        "reportId": new_id(),
        "reporterId": user_id,
        "targetUserId": target_id,
        "matchId": match_id,
        "reason": reason,
        "reasonLabel": REASONS[reason],
        "detail": (body.get("detail") or "").strip()[:MAX_DETAIL],
        "status": "OPEN",
        "createdAt": now_iso(),
    })

    # 通報件数や停止状態は通報者に見せない（報復や当て推量を招くため）
    return response(201, {
        "reportId": result["reportId"],
        "message": "通報を受け付けました。運営で確認します。",
    })
