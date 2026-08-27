"""取引後の評価。取引完了したマッチの相手だけ、1 回だけ評価できる。"""

import db
from common import ApiError, now_iso, response

MAX_COMMENT = 200


def create(ctx):
    user_id = ctx["user"]["userId"]
    body = ctx["body"]

    match_id = body.get("matchId")
    if not match_id:
        raise ApiError(400, "matchId を指定してください", "invalid_request")

    try:
        rating = int(body.get("rating"))
    except (TypeError, ValueError):
        raise ApiError(400, "rating は 1〜5 の数値で指定してください", "invalid_rating")
    if not 1 <= rating <= 5:
        raise ApiError(400, "rating は 1〜5 で指定してください", "invalid_rating")

    match = db.get_match(match_id)
    if not match:
        raise ApiError(404, "マッチが見つかりません", "not_found")
    if user_id not in (match["userAId"], match["userBId"]):
        raise ApiError(403, "このマッチの当事者ではありません", "forbidden")
    if match.get("status") != "COMPLETED":
        raise ApiError(409, "取引完了したマッチのみ評価できます", "not_completed")

    partner_id = match["userBId"] if user_id == match["userAId"] else match["userAId"]

    review = db.put_review(partner_id, {
        "matchId": match_id,
        "fromUserId": user_id,
        "rating": rating,
        "comment": (body.get("comment") or "").strip()[:MAX_COMMENT],
        "createdAt": now_iso(),
    })

    return response(201, {"review": {
        "matchId": match_id,
        "rating": rating,
        "comment": review.get("comment"),
        "createdAt": review.get("createdAt"),
    }})
