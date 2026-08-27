"""LINE Messaging API への送信と webhook 署名検証。

外部ライブラリを使わず標準ライブラリだけで叩く（Lambda のパッケージを軽くするため）。
"""

import base64
import hashlib
import hmac
import json
import logging
import os
import urllib.error
import urllib.request

log = logging.getLogger()
log.setLevel(logging.INFO)

PUSH_URL = "https://api.line.me/v2/bot/message/push"
REPLY_URL = "https://api.line.me/v2/bot/message/reply"

TYPE_LABEL = {"GIVE": "【譲】", "WANT": "【求】", "COMPANION": "【同行者求】"}


def _post(url, payload):
    token = os.environ.get("LINE_CHANNEL_ACCESS_TOKEN")
    if not token:
        log.error("LINE_CHANNEL_ACCESS_TOKEN が未設定のため送信しません")
        return False

    req = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            return res.status == 200
    except urllib.error.HTTPError as e:
        # 通知の失敗で API 本体を落とさない。ログに残して続行する
        log.warning("LINE 送信失敗 %s: %s", e.code, e.read().decode("utf-8", "replace"))
    except Exception as e:
        log.warning("LINE 送信失敗: %s", e)
    return False


def push(user_id, messages):
    return _post(PUSH_URL, {"to": user_id, "messages": messages})


def reply(reply_token, messages):
    return _post(REPLY_URL, {"replyToken": reply_token, "messages": messages})


def text(body):
    return {"type": "text", "text": body}


def location(title, lat, lon, address=""):
    """LINE の位置情報メッセージ。トークに地図が出て、タップで案内を開ける。"""
    return {
        "type": "location",
        "title": (title or "共有された場所")[:100],
        "address": (address or f"{lat:.5f}, {lon:.5f}")[:100],
        "latitude": float(lat),
        "longitude": float(lon),
    }


def verify_signature(body, signature):
    """webhook が本当に LINE から来たものか確認する。"""
    secret = os.environ.get("LINE_CHANNEL_SECRET")
    if not secret or not signature:
        return False
    digest = hmac.new(secret.encode("utf-8"), body.encode("utf-8"), hashlib.sha256).digest()
    return hmac.compare_digest(base64.b64encode(digest).decode(), signature)


def liff_url(path=""):
    liff_id = os.environ.get("LIFF_ID", "")
    return f"https://liff.line.me/{liff_id}{path}"


def match_flex(card, matched_labels, match_id, owner=None, distance=None):
    """マッチ通知の Flex Message。％ではなく一致したタグそのものを見せる。"""
    label = TYPE_LABEL.get(card.get("type"), "")
    title = f"{label}{card.get('title') or ''}"
    tag_line = " / ".join(matched_labels) if matched_labels else "-"

    details = []
    if distance:
        details.append(f"約{distance}")
    if card.get("dates"):
        details.append(" ".join(card["dates"][:3]))
    if owner and owner.get("ratingCount"):
        details.append(f"★{owner['ratingAvg']}（{owner['ratingCount']}件）")
    elif owner:
        details.append("評価なし（新規）")

    body_contents = [
        {"type": "text", "text": title, "weight": "bold", "size": "md", "wrap": True},
        {"type": "separator", "margin": "md"},
        {"type": "box", "layout": "vertical", "margin": "md", "spacing": "sm", "contents": [
            {"type": "text", "text": f"一致したタグ {len(matched_labels)}件",
             "size": "xs", "color": "#888888"},
            {"type": "text", "text": tag_line, "size": "sm", "wrap": True, "color": "#06C755"},
        ]},
    ]
    if details:
        body_contents.append({
            "type": "text", "text": " ・ ".join(details),
            "size": "xs", "color": "#666666", "margin": "md", "wrap": True,
        })

    return {
        "type": "flex",
        "altText": f"条件に一致するカードが見つかりました（一致 {len(matched_labels)}件）",
        "contents": {
            "type": "bubble",
            "header": {"type": "box", "layout": "vertical", "contents": [
                {"type": "text", "text": "条件に一致するカードが見つかりました！",
                 "size": "sm", "weight": "bold", "color": "#FFFFFF", "wrap": True},
            ], "backgroundColor": "#06C755", "paddingAll": "12px"},
            "body": {"type": "box", "layout": "vertical", "contents": body_contents},
            "footer": {"type": "box", "layout": "vertical", "contents": [
                {"type": "button", "style": "primary", "color": "#06C755", "height": "sm",
                 "action": {"type": "uri", "label": "カードを見る",
                            "uri": liff_url(f"/matches/{match_id}")}},
            ]},
        },
    }


def notify_match(user_id, card, matched_labels, match_id, owner=None, distance=None):
    """matching.run() に渡すコールバック。"""
    return push(user_id, [match_flex(card, matched_labels, match_id, owner, distance)])


def group_flex(group, user_id):
    """環状交換の提案。自分が誰に渡し、誰から受け取るかを 1 枚で見せる。"""
    steps = group["steps"]
    length = int(group["length"])

    gives = next((s for s in steps if s["fromUserId"] == user_id), None)
    receives = next((s for s in steps if s["toUserId"] == user_id), None)

    def row(label, tags, color):
        return {
            "type": "box", "layout": "vertical", "margin": "md", "contents": [
                {"type": "text", "text": label, "size": "xs", "color": "#888888"},
                {"type": "text", "text": " / ".join(tags) if tags else "-",
                 "size": "sm", "weight": "bold", "color": color, "wrap": True},
            ],
        }

    body = [
        {"type": "text", "text": f"{length}人で交換すると成立します",
         "weight": "bold", "size": "md", "wrap": True},
        {"type": "separator", "margin": "md"},
    ]
    if gives:
        body.append(row("あなたが渡すもの", gives.get("matchedLabels"), "#E43D81"))
    if receives:
        body.append(row("あなたが受け取るもの", receives.get("matchedLabels"), "#00C2A8"))
    body.append({
        "type": "text",
        "text": "全員が承諾すると成立します。",
        "size": "xs", "color": "#666666", "margin": "md", "wrap": True,
    })

    return {
        "type": "flex",
        "altText": f"{length}人での交換が見つかりました",
        "contents": {
            "type": "bubble",
            "header": {"type": "box", "layout": "vertical", "contents": [
                {"type": "text", "text": "交換の輪が見つかりました！",
                 "size": "sm", "weight": "bold", "color": "#FFFFFF", "wrap": True},
            ], "backgroundColor": "#CB9605", "paddingAll": "12px"},
            "body": {"type": "box", "layout": "vertical", "contents": body},
            "footer": {"type": "box", "layout": "vertical", "contents": [
                {"type": "button", "style": "primary", "color": "#E43D81", "height": "sm",
                 "action": {"type": "uri", "label": "内容を見る",
                            "uri": liff_url(f"/groups/{group['groupId']}")}},
            ]},
        },
    }


def notify_group(group):
    """参加者全員に提案を送る。"""
    for member in group["members"]:
        push(member, [group_flex(group, member)])


# ---------------- 汎用の通知カード ----------------

PINK = "#E43D81"
TEAL = "#00C2A8"
GOLD = "#CB9605"


def action_card(header, title, lines=None, button=None, uri=None, color=PINK):
    """LINE に送る通知カード。見出し・本文・ボタンだけの共通レイアウト。

    テキストだけの通知より一覧で埋もれにくく、そのままアプリを開ける。
    """
    body = [{"type": "text", "text": title, "weight": "bold", "size": "md", "wrap": True}]

    if lines:
        body.append({"type": "separator", "margin": "md"})
        body.append({
            "type": "box", "layout": "vertical", "margin": "md", "spacing": "sm",
            "contents": [
                {"type": "text", "text": line, "size": "sm", "color": "#555555", "wrap": True}
                for line in lines
            ],
        })

    bubble = {
        "type": "bubble",
        "header": {
            "type": "box", "layout": "vertical",
            "contents": [{
                "type": "text", "text": header, "size": "sm",
                "weight": "bold", "color": "#FFFFFF", "wrap": True,
            }],
            "backgroundColor": color, "paddingAll": "12px",
        },
        "body": {"type": "box", "layout": "vertical", "contents": body},
    }

    if button and uri:
        bubble["footer"] = {
            "type": "box", "layout": "vertical",
            "contents": [{
                "type": "button", "style": "primary", "color": color, "height": "sm",
                "action": {"type": "uri", "label": button, "uri": uri},
            }],
        }

    return {"type": "flex", "altText": f"{header} {title}", "contents": bubble}


def push_card(user_id, **kwargs):
    return push(user_id, [action_card(**kwargs)])
