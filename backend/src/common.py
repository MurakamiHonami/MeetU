"""共通ユーティリティ: レスポンス生成 / ID 発行 / 例外。"""

import datetime
import decimal
import json
import secrets
import time

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
}


class ApiError(Exception):
    """ハンドラから投げるとそのまま HTTP エラーになる例外。"""

    def __init__(self, status, message, code=None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.code = code or "error"


class _Encoder(json.JSONEncoder):
    """DynamoDB が返す Decimal を JSON に載せる。"""

    def default(self, o):
        if isinstance(o, decimal.Decimal):
            return int(o) if o % 1 == 0 else float(o)
        if isinstance(o, set):
            return sorted(o)
        return super().default(o)


def response(status, body):
    return {
        "statusCode": status,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, ensure_ascii=False, cls=_Encoder),
    }


def now_iso():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")


_last_ns = 0


def new_id(prefix=""):
    """時系列でソートできる ID。先頭 19 桁が epoch ナノ秒。

    トークのメッセージはこの ID をソートキーに使うので、辞書順と送信順が
    必ず一致していないといけない。ミリ秒だと同じミリ秒に複数件作られたとき
    末尾の乱数で順序が入れ替わるため、ナノ秒 + プロセス内カウンタで単調増加させる。
    """
    global _last_ns
    now_ns = time.time_ns()
    if now_ns <= _last_ns:
        now_ns = _last_ns + 1
    _last_ns = now_ns
    return f"{prefix}{now_ns:019d}{secrets.token_hex(4)}"


def ttl_after_days(days):
    return int(time.time()) + days * 86400
