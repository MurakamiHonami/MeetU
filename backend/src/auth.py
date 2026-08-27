"""LIFF の ID Token を LINE のサーバで検証して userId を得る。

ID Token はクライアントから送られてくる以上そのまま信用してはいけない。
必ず LINE の verify エンドポイントに投げ、aud が自分の Login チャネル ID
であることまで確認する。
"""

import json
import os
import time
import urllib.parse
import urllib.request

from common import ApiError

VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify"
_CACHE = {}          # token -> (payload, 失効時刻)
_CACHE_TTL = 300     # 秒。毎リクエスト外部通信するのを避ける
_CACHE_MAX = 500


def _verify_remote(id_token, channel_id):
    data = urllib.parse.urlencode({"id_token": id_token, "client_id": channel_id}).encode()
    req = urllib.request.Request(
        VERIFY_URL, data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            return json.loads(res.read())
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")
        raise ApiError(401, f"ID Token の検証に失敗しました: {detail}", "invalid_token")
    except Exception as e:
        raise ApiError(503, f"LINE の検証サーバに接続できません: {e}", "verify_unavailable")


def verify(id_token):
    """検証済みペイロードを返す。sub が userId。"""
    channel_id = os.environ.get("LINE_LOGIN_CHANNEL_ID")
    if not channel_id:
        raise ApiError(500, "LINE_LOGIN_CHANNEL_ID が未設定です", "config")

    hit = _CACHE.get(id_token)
    if hit and hit[1] > time.time():
        return hit[0]

    payload = _verify_remote(id_token, channel_id)

    # verify API 側でも検証されるが、取り違えを防ぐため自前でも確認する
    if payload.get("aud") != channel_id:
        raise ApiError(401, "ID Token の aud が一致しません", "invalid_audience")
    if payload.get("exp", 0) <= time.time():
        raise ApiError(401, "ID Token の有効期限が切れています", "expired_token")
    if not payload.get("sub"):
        raise ApiError(401, "ID Token に sub が含まれていません", "invalid_token")

    if len(_CACHE) > _CACHE_MAX:
        _CACHE.clear()
    _CACHE[id_token] = (payload, min(time.time() + _CACHE_TTL, payload["exp"]))
    return payload


def user_from_event(event):
    """API Gateway イベントから認証済みユーザー情報を取り出す。"""
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    raw = headers.get("authorization", "")
    if not raw.lower().startswith("bearer "):
        raise ApiError(401, "Authorization ヘッダがありません", "no_token")

    payload = verify(raw[7:].strip())
    return {
        "userId": payload["sub"],
        "displayName": payload.get("name") or "名無し",
        "pictureUrl": payload.get("picture"),
    }
