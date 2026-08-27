"""トークに送る画像のアップロード。

Lambda を経由すると 6MB の制限とコストがかかるので、
署名付き URL を発行してブラウザから S3 へ直接 PUT させる。
バケットは非公開のままで、閲覧側も署名付き URL を都度発行する。
"""

import logging
import os
from urllib.parse import urlparse

import boto3
from botocore.config import Config

import db
from common import ApiError, new_id, response

# 表示に耐えて、かつ回線に優しい範囲
ALLOWED = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
# 拡張子から MIME を戻す。閲覧用 URL で正しい型を返すのに使う
BY_EXTENSION = {ext: mime for mime, ext in ALLOWED.items()}
MAX_BYTES = 5 * 1024 * 1024
PUT_EXPIRES = 300      # アップロード用は 5 分
GET_EXPIRES = 3600     # 閲覧用は 1 時間

log = logging.getLogger()
log.setLevel(logging.INFO)

_s3 = None


def s3():
    global _s3
    if _s3 is None:
        region = os.environ.get("AWS_REGION") or "ap-northeast-1"
        _s3 = boto3.client(
            "s3",
            region_name=region,
            # リージョンのエンドポイントを明示する。グローバル(s3.amazonaws.com)だと
            # 別リージョンのバケットへの PUT が 307 リダイレクトになり、
            # ブラウザは CORS 越しにリダイレクトを追えず接続エラーになる
            endpoint_url=f"https://s3.{region}.amazonaws.com",
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "virtual"},
            ),
        )
    return _s3


def bucket():
    name = os.environ.get("UPLOAD_BUCKET")
    if not name:
        raise ApiError(500, "UPLOAD_BUCKET が未設定です", "config")
    return name


def presign_get(key):
    """閲覧用の一時 URL。キーが無効ならそのまま None。"""
    if not key:
        return None

    try:
        params = {"Bucket": bucket(), "Key": key}
        # アップロード時に Content-Type を署名に含めていないので、
        # 保存時の型は当てにせず、拡張子から判断して返す
        extension = key.rsplit(".", 1)[-1].lower() if "." in key else ""
        mime = BY_EXTENSION.get(extension)
        if mime:
            params["ResponseContentType"] = mime

        return s3().generate_presigned_url(
            "get_object", Params=params, ExpiresIn=GET_EXPIRES,
        )
    except Exception:
        # 画像 1 枚の URL が作れないだけでトーク全体を落とさない
        return None


def create(ctx):
    """アップロード先の署名付き URL を返す。"""
    user = db.ensure_user(ctx["user"])
    if db.is_blocked(user):
        raise ApiError(403, "通報が重なったため現在ご利用いただけません", "suspended")

    content_type = (ctx["body"].get("contentType") or "").lower()
    if content_type not in ALLOWED:
        raise ApiError(
            400, "画像は JPEG / PNG / WebP のみ送れます", "unsupported_type"
        )

    size = ctx["body"].get("size")
    if size is not None:
        try:
            size = int(size)
        except (TypeError, ValueError):
            raise ApiError(400, "size は数値で指定してください", "invalid_size")
        if size > MAX_BYTES:
            raise ApiError(400, "画像は 5MB 以内にしてください", "too_large")

    # 1 対 1 のトークとグループトークのどちらからも使う
    match_id = ctx["body"].get("matchId")
    group_id = ctx["body"].get("groupId")
    if not match_id and not group_id:
        raise ApiError(400, "matchId か groupId を指定してください", "invalid_request")

    if match_id:
        match = db.get_match(match_id)
        if not match:
            raise ApiError(404, "マッチが見つかりません", "not_found")
        if user["userId"] not in (match["userAId"], match["userBId"]):
            raise ApiError(403, "このマッチの当事者ではありません", "forbidden")
        thread_id = match_id
    else:
        group = db.get_group(group_id)
        if not group:
            raise ApiError(404, "グループが見つかりません", "not_found")
        if user["userId"] not in group["members"]:
            raise ApiError(403, "このグループの参加者ではありません", "forbidden")
        thread_id = group_id

    key = f"chat/{thread_id}/{new_id()}.{ALLOWED[content_type]}"
    # ContentType は署名に含めない。含めるとブラウザが送るヘッダと
    # 1 文字でも違えば SignatureDoesNotMatch になり、原因が分かりにくい。
    # 型は拡張子で担保し、閲覧時に ResponseContentType で正しく返す。
    upload_url = s3().generate_presigned_url(
        "put_object",
        Params={"Bucket": bucket(), "Key": key},
        ExpiresIn=PUT_EXPIRES,
    )

    # うまく上がらないときに切り分けられるよう、ホストだけ残す（署名は載せない）
    log.info("presigned PUT host=%s key=%s", urlparse(upload_url).netloc, key)

    return response(200, {
        "uploadUrl": upload_url,
        "imageKey": key,
        "contentType": content_type,
        "maxBytes": MAX_BYTES,
    })
