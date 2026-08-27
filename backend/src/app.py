"""API Gateway (/api/{proxy+}) のルーター。

全エンドポイントで LIFF の ID Token を検証する。webhook だけは別 Lambda。
"""

import json
import logging
import re

from common import ApiError, response
import auth
from handlers import (
    cards, feed, groups, matches, me, messages, nearby, reports, reviews, uploads,
)
from handlers import tags as tags_handler

log = logging.getLogger()
log.setLevel(logging.INFO)

# 上から順に評価する。cards/mine を cards/{id} より先に置くこと
ROUTES = [
    ("GET",    r"^me$",                        me.get_me),
    ("PUT",    r"^me$",                        me.update_me),
    ("GET",    r"^me/reviews$",                me.my_reviews),

    ("GET",    r"^feed$",                      feed.list_),
    ("POST",   r"^feed/([^/]+)/save$",         feed.save),
    ("POST",   r"^feed/([^/]+)/skip$",         feed.skip),
    ("GET",    r"^saved$",                     feed.list_saved),
    ("DELETE", r"^saved/([^/]+)$",             feed.unsave),

    ("GET",    r"^nearby$",                    nearby.search),
    ("POST",   r"^uploads$",                   uploads.create),

    ("GET",    r"^tags$",                      tags_handler.suggest),
    ("POST",   r"^tags$",                      tags_handler.create),

    ("POST",   r"^cards$",                     cards.create),
    ("GET",    r"^cards$",                     cards.search),
    ("GET",    r"^cards/mine$",                cards.mine),
    ("GET",    r"^cards/([^/]+)/matches$",     cards.candidates),
    ("GET",    r"^cards/([^/]+)$",             cards.get_one),
    ("DELETE", r"^cards/([^/]+)$",             cards.close),

    ("GET",    r"^matches$",                   matches.list_all),
    ("GET",    r"^matches/([^/]+)$",           matches.get_one),
    ("POST",   r"^matches/([^/]+)/accept$",    matches.accept),
    ("POST",   r"^matches/([^/]+)/decline$",   matches.decline),
    ("POST",   r"^matches/([^/]+)/complete$",  matches.complete),
    ("GET",    r"^matches/([^/]+)/messages$",  messages.list_),
    ("POST",   r"^matches/([^/]+)/messages$",  messages.create),

    ("GET",    r"^groups$",                    groups.list_all),
    ("GET",    r"^groups/([^/]+)$",            groups.get_one),
    ("POST",   r"^groups/([^/]+)/accept$",     groups.accept),
    ("POST",   r"^groups/([^/]+)/decline$",    groups.decline),
    ("POST",   r"^groups/([^/]+)/complete$",   groups.complete),
    ("GET",    r"^groups/([^/]+)/messages$",   groups.list_messages),
    ("POST",   r"^groups/([^/]+)/messages$",   groups.send_message),

    ("POST",   r"^reviews$",                   reviews.create),
    ("POST",   r"^reports$",                   reports.create),
]


def _parse_body(event):
    raw = event.get("body")
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except ValueError:
        raise ApiError(400, "リクエストボディが JSON ではありません", "invalid_json")
    if not isinstance(parsed, dict):
        raise ApiError(400, "リクエストボディはオブジェクトにしてください", "invalid_json")
    return parsed


def lambda_handler(event, context):
    method = event.get("httpMethod", "GET")
    if method == "OPTIONS":
        return response(204, {})

    path = (event.get("pathParameters") or {}).get("proxy") or ""
    path = path.strip("/")

    try:
        for route_method, pattern, handler in ROUTES:
            if route_method != method:
                continue
            matched = re.match(pattern, path)
            if not matched:
                continue

            ctx = {
                "user": auth.user_from_event(event),
                "body": _parse_body(event),
                "query": event.get("queryStringParameters") or {},
            }
            return handler(ctx, *matched.groups())

        raise ApiError(404, f"{method} /{path} は存在しません", "not_found")

    except ApiError as e:
        return response(e.status, {"error": e.code, "message": e.message})
    except Exception:
        log.exception("未処理の例外 path=%s method=%s", path, method)
        return response(500, {"error": "internal", "message": "サーバ内部エラーが発生しました"})
