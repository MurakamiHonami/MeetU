"""Messaging API の webhook。

友だち追加時の案内と、トークからアプリを開くための返信だけを担当する。
署名を検証しないと誰でも叩けてしまうので、必ず先に検証する。
"""

import json
import logging

import notify

log = logging.getLogger()
log.setLevel(logging.INFO)

WELCOME = (
    "友だち追加ありがとうございます！\n\n"
    "【譲】【求】【同行者求】のカードをタグで登録すると、\n"
    "条件に合うカードが出たときにここへお知らせします。\n\n"
    "「◯件以上タグが一致したら通知」という設定もできます。"
)

HELP = (
    "下のメニュー、または次のリンクからアプリを開けます。\n"
    "・カードを登録する\n"
    "・募集を探す\n"
    "・マッチ一覧を見る"
)


def _open_app_message(body):
    return {
        "type": "template",
        "altText": body,
        "template": {
            "type": "buttons",
            "text": body[:160],
            "actions": [{"type": "uri", "label": "アプリを開く", "uri": notify.liff_url()}],
        },
    }


def lambda_handler(event, context):
    body = event.get("body") or ""
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}

    if not notify.verify_signature(body, headers.get("x-line-signature")):
        log.warning("署名検証に失敗しました")
        return {"statusCode": 403, "body": "invalid signature"}

    try:
        payload = json.loads(body)
    except ValueError:
        return {"statusCode": 400, "body": "invalid json"}

    for line_event in payload.get("events", []):
        try:
            _handle(line_event)
        except Exception:
            # 1 件の失敗で 200 を返さないと LINE 側がリトライし続けるので握る
            log.exception("イベント処理に失敗しました")

    return {"statusCode": 200, "body": "OK"}


def _handle(line_event):
    kind = line_event.get("type")
    reply_token = line_event.get("replyToken")

    if kind == "follow":
        notify.reply(reply_token, [notify.text(WELCOME), _open_app_message(HELP)])
        return

    if kind == "message" and line_event.get("message", {}).get("type") == "text":
        notify.reply(reply_token, [_open_app_message(HELP)])
        return

    log.info("未対応のイベント: %s", kind)
