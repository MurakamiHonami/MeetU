"""DynamoDB アクセス層。テーブルは 1 本（シングルテーブル設計）。

キー設計:
  USER#<uid>     / PROFILE            ユーザー
  CARD#<cid>     / META               カード本体
  USER#<uid>     / CARD#<cid>         ユーザーのカード一覧
  TAGIDX#<tag>   / <type>#<cid>       タグ逆引き索引（候補抽出の要）
  TAG#<tag>      / META               タグマスタ（サジェスト用・GSI1）
  MATCH#<mid>    / META               マッチ
  USER#<uid>     / MATCH#<mid>        ユーザーのマッチ一覧
  USER#<uid>     / REVIEW#<rid>       受けた評価
  MSG#<mid>      / <messageId>        トークのメッセージ（時系列にソート済み）
  GMATCH#<gid>   / META               環状交換のグループ
  USER#<uid>     / GMATCH#<gid>       参加しているグループ
  COOC#<tagA>    / <tagB>             タグの共起回数（おすすめの意味拡張に使う）
  USER#<uid>     / SAVED#<cid>        スワイプで保存したカード
  USER#<uid>     / SKIP#<cid>         スワイプで見送ったカード
  REPORT#<rid>   / META               通報
"""

import os
import time

import boto3
from boto3.dynamodb.conditions import Key

from common import ApiError, now_iso, ttl_after_days

_dynamodb = boto3.resource("dynamodb")
_table = None

CARD_TTL_DAYS = 90
MESSAGE_TTL_DAYS = 180
NOTIFY_COOLDOWN_SEC = 300   # 連投のたびに Push しない（無料枠を守る）
# 本文が無いメッセージの一覧プレビュー
PREVIEW_BY_KIND = {"image": "[画像]", "location": "[位置情報]"}
SUSPEND_THRESHOLD = 3   # 通報がこの件数に達したら自動停止


def table():
    global _table
    if _table is None:
        name = os.environ.get("TABLE_NAME")
        if not name:
            raise ApiError(500, "TABLE_NAME が未設定です", "config")
        _table = _dynamodb.Table(name)
    return _table


def _query_all(**kwargs):
    """ページングを畳んで全件返す。"""
    items, start = [], None
    while True:
        if start:
            kwargs["ExclusiveStartKey"] = start
        res = table().query(**kwargs)
        items.extend(res.get("Items", []))
        start = res.get("LastEvaluatedKey")
        if not start:
            return items


# ---------------- ユーザー ----------------

def get_user(user_id):
    res = table().get_item(Key={"PK": f"USER#{user_id}", "SK": "PROFILE"})
    return res.get("Item")


def ensure_user(profile):
    """初回アクセス時に自動作成。既存なら表示名・アイコンだけ追従させる。"""
    user_id = profile["userId"]
    existing = get_user(user_id)
    if existing:
        changed = (
            existing.get("displayName") != profile["displayName"]
            or existing.get("pictureUrl") != profile.get("pictureUrl")
        )
        if changed:
            table().update_item(
                Key={"PK": f"USER#{user_id}", "SK": "PROFILE"},
                UpdateExpression="SET displayName = :n, pictureUrl = :p, updatedAt = :t",
                ExpressionAttributeValues={
                    ":n": profile["displayName"],
                    ":p": profile.get("pictureUrl"),
                    ":t": now_iso(),
                },
            )
            existing["displayName"] = profile["displayName"]
            existing["pictureUrl"] = profile.get("pictureUrl")
        return existing

    item = {
        "PK": f"USER#{user_id}", "SK": "PROFILE",
        "userId": user_id,
        "displayName": profile["displayName"],
        "pictureUrl": profile.get("pictureUrl"),
        "ratingSum": 0, "ratingCount": 0, "reportCount": 0,
        "tradeCount": 0,
        "status": "ACTIVE",
        "createdAt": now_iso(), "updatedAt": now_iso(),
    }
    table().put_item(Item=item)
    return item


def public_user(user):
    """相手に見せてよい範囲だけ抜き出す。"""
    if not user:
        return None
    count = int(user.get("ratingCount") or 0)
    avg = round(float(user.get("ratingSum") or 0) / count, 1) if count else None
    return {
        "userId": user["userId"],
        "displayName": user.get("displayName"),
        "pictureUrl": user.get("pictureUrl"),
        "ratingAvg": avg,
        "ratingCount": count,
        "tradeCount": int(user.get("tradeCount") or 0),
        "isNew": count == 0,
    }


def is_blocked(user):
    return not user or user.get("status") == "SUSPENDED"


# ---------------- カード ----------------

def get_card(card_id):
    res = table().get_item(Key={"PK": f"CARD#{card_id}", "SK": "META"})
    return res.get("Item")


def put_card(card):
    """カード本体・ユーザー索引・タグ索引をまとめて書く。"""
    card_id = card["cardId"]
    owner = card["ownerId"]
    ctype = card["type"]
    with table().batch_writer() as batch:
        item = dict(card)
        item["PK"] = f"CARD#{card_id}"
        item["SK"] = "META"
        item["ttl"] = ttl_after_days(CARD_TTL_DAYS)
        # 新着フィード用。日付ごとに分けて書き込みの集中を避ける
        item["GSI2PK"] = f"FEED#{card['createdAt'][:10]}"
        item["GSI2SK"] = card_id
        # 位置が付いていれば近傍検索の索引も張る
        location = card.get("location")
        if location:
            item["GSI3PK"] = f"GEO#{location['geohash'][:5]}"
            item["GSI3SK"] = card_id
        batch.put_item(Item=item)

        batch.put_item(Item={
            "PK": f"USER#{owner}", "SK": f"CARD#{card_id}",
            "cardId": card_id, "type": ctype,
            "title": card.get("title"), "status": card["status"],
            "createdAt": card["createdAt"],
            "ttl": ttl_after_days(CARD_TTL_DAYS),
        })
        for tag in card.get("tags", []):
            batch.put_item(Item={
                "PK": f"TAGIDX#{tag}", "SK": f"{ctype}#{card_id}",
                "cardId": card_id, "ownerId": owner, "type": ctype,
                "createdAt": card["createdAt"],
                "ttl": ttl_after_days(CARD_TTL_DAYS),
            })
    return card


def close_card(card_id, owner_id):
    card = get_card(card_id)
    if not card:
        raise ApiError(404, "カードが見つかりません", "not_found")
    if card["ownerId"] != owner_id:
        raise ApiError(403, "自分のカードのみ操作できます", "forbidden")

    table().update_item(
        Key={"PK": f"CARD#{card_id}", "SK": "META"},
        UpdateExpression="SET #s = :c, updatedAt = :t",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":c": "CLOSED", ":t": now_iso()},
    )
    # 索引を残すと閉じたカードが候補に出続けるので消す
    with table().batch_writer() as batch:
        for tag in card.get("tags", []):
            batch.delete_item(Key={"PK": f"TAGIDX#{tag}", "SK": f"{card['type']}#{card_id}"})
        batch.put_item(Item={
            "PK": f"USER#{owner_id}", "SK": f"CARD#{card_id}",
            "cardId": card_id, "type": card["type"], "title": card.get("title"),
            "status": "CLOSED", "createdAt": card["createdAt"],
            "ttl": ttl_after_days(CARD_TTL_DAYS),
        })
    card["status"] = "CLOSED"
    return card


def list_user_cards(user_id):
    refs = _query_all(
        KeyConditionExpression=Key("PK").eq(f"USER#{user_id}") & Key("SK").begins_with("CARD#"),
        ScanIndexForward=False,
    )
    cards = []
    for ref in refs:
        card = get_card(ref["cardId"])
        if card:
            cards.append(card)
    return cards


def cards_by_tag(tag, types=None):
    """タグ索引を引く。候補抽出の中核。"""
    cond = Key("PK").eq(f"TAGIDX#{tag}")
    if types and len(types) == 1:
        cond = cond & Key("SK").begins_with(f"{types[0]}#")
    hits = _query_all(KeyConditionExpression=cond)
    if types and len(types) > 1:
        hits = [h for h in hits if h.get("type") in types]
    return hits


# ---------------- タグマスタ ----------------

def get_tag(tag_id):
    res = table().get_item(Key={"PK": f"TAG#{tag_id}", "SK": "META"})
    return res.get("Item")


def upsert_tag(tag_id, display_name, category="other"):
    """無ければ作る。あれば使用回数を増やす。"""
    table().update_item(
        Key={"PK": f"TAG#{tag_id}", "SK": "META"},
        UpdateExpression=(
            "SET tagId = :i, GSI1PK = :gp, GSI1SK = :gs, "
            "displayName = if_not_exists(displayName, :d), "
            "category = if_not_exists(category, :c), "
            "createdAt = if_not_exists(createdAt, :t) "
            "ADD useCount :one"
        ),
        ExpressionAttributeValues={
            ":i": tag_id,
            ":gp": f"TAG#{tag_id[0]}",   # 先頭 1 文字で分散
            ":gs": tag_id,
            ":d": display_name, ":c": category, ":t": now_iso(), ":one": 1,
        },
    )


def search_tags(prefix, limit=20):
    """前方一致 + 使用回数の多い順。prefix が空なら人気タグを返す。"""
    if prefix:
        items = _query_all(
            IndexName="GSI1",
            KeyConditionExpression=Key("GSI1PK").eq(f"TAG#{prefix[0]}")
            & Key("GSI1SK").begins_with(prefix),
        )
    else:
        items = []
        for bucket in _popular_buckets():
            items.extend(_query_all(
                IndexName="GSI1", KeyConditionExpression=Key("GSI1PK").eq(bucket)
            ))
    items.sort(key=lambda t: (-int(t.get("useCount") or 0), t.get("tagId", "")))
    return items[:limit]


def _popular_buckets():
    """人気タグの初期表示用。よく使われる先頭文字のバケットだけ舐める。"""
    return [f"TAG#{c}" for c in "あいうかきくさしすたちつなにはひふまみむやゆらりるわ"]


# ---------------- マッチ ----------------

def match_id_for(card_a, card_b):
    """カードの組で決まる ID。何度実行しても同じマッチは 1 件。"""
    lo, hi = sorted([card_a, card_b])
    return f"{lo}_{hi}"


def get_match(match_id):
    res = table().get_item(Key={"PK": f"MATCH#{match_id}", "SK": "META"})
    return res.get("Item")


def save_match(match):
    """既にあれば False を返す（＝通知済みなので再通知しない）。"""
    match_id = match["matchId"]
    item = dict(match)
    item["PK"] = f"MATCH#{match_id}"
    item["SK"] = "META"
    try:
        table().put_item(Item=item, ConditionExpression="attribute_not_exists(PK)")
    except table().meta.client.exceptions.ConditionalCheckFailedException:
        return False

    with table().batch_writer() as batch:
        pairs = ((match["userAId"], match["userBId"]), (match["userBId"], match["userAId"]))
        for me, partner in pairs:
            batch.put_item(Item={
                "PK": f"USER#{me}", "SK": f"MATCH#{match_id}",
                "matchId": match_id, "partnerId": partner,
                "matchedTags": match["matchedTags"],
                "matchCount": match["matchCount"],
                "status": match["status"], "createdAt": match["createdAt"],
            })
    return True


def list_matches(user_id):
    refs = _query_all(
        KeyConditionExpression=Key("PK").eq(f"USER#{user_id}") & Key("SK").begins_with("MATCH#"),
        ScanIndexForward=False,
    )
    out = []
    for ref in refs:
        match = get_match(ref["matchId"])
        if match:
            # 未読判定に使うので、自分側の既読時刻を載せて返す
            match["myLastReadAt"] = ref.get("lastReadAt")
            out.append(match)
    return out


def accept_match(match_id, actor_id):
    """片方が承諾した状態を記録し、両者そろったら ACCEPTED にする。"""
    match = get_match(match_id)
    if not match:
        raise ApiError(404, "マッチが見つかりません", "not_found")
    if actor_id not in (match["userAId"], match["userBId"]):
        raise ApiError(403, "このマッチの当事者ではありません", "forbidden")
    if match.get("status") == "DECLINED":
        raise ApiError(409, "このマッチは辞退済みです", "declined")

    mine, theirs = ("acceptedA", "acceptedB")
    if actor_id == match["userBId"]:
        mine, theirs = theirs, mine

    table().update_item(
        Key={"PK": f"MATCH#{match_id}", "SK": "META"},
        UpdateExpression=f"SET {mine} = :t, updatedAt = :u",
        ExpressionAttributeValues={":t": True, ":u": now_iso()},
    )
    match[mine] = True

    both = bool(match.get(theirs))
    if both:
        match = update_match_status(match_id, "ACCEPTED", actor_id)
        match[mine] = True
        match[theirs] = True
    return match, both


def update_match_status(match_id, status, actor_id):
    match = get_match(match_id)
    if not match:
        raise ApiError(404, "マッチが見つかりません", "not_found")
    if actor_id not in (match["userAId"], match["userBId"]):
        raise ApiError(403, "このマッチの当事者ではありません", "forbidden")

    table().update_item(
        Key={"PK": f"MATCH#{match_id}", "SK": "META"},
        UpdateExpression="SET #s = :s, updatedAt = :t",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":s": status, ":t": now_iso()},
    )
    for uid in (match["userAId"], match["userBId"]):
        table().update_item(
            Key={"PK": f"USER#{uid}", "SK": f"MATCH#{match_id}"},
            UpdateExpression="SET #s = :s",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":s": status},
        )
    match["status"] = status
    return match


# ---------------- 評価 ----------------

def put_review(to_user_id, review):
    """1 マッチにつき 1 回だけ。二重投稿は条件式で弾く。"""
    review_id = review["matchId"] + "#" + review["fromUserId"]
    item = dict(review)
    item["reviewId"] = review_id
    item["PK"] = f"USER#{to_user_id}"
    item["SK"] = f"REVIEW#{review_id}"
    try:
        table().put_item(Item=item, ConditionExpression="attribute_not_exists(SK)")
    except table().meta.client.exceptions.ConditionalCheckFailedException:
        raise ApiError(409, "この取引はすでに評価済みです", "already_reviewed")

    table().update_item(
        Key={"PK": f"USER#{to_user_id}", "SK": "PROFILE"},
        UpdateExpression="ADD ratingSum :r, ratingCount :one, tradeCount :one",
        ExpressionAttributeValues={":r": int(review["rating"]), ":one": 1},
    )
    return item


def list_reviews(user_id, limit=20):
    items = _query_all(
        KeyConditionExpression=Key("PK").eq(f"USER#{user_id}") & Key("SK").begins_with("REVIEW#"),
        ScanIndexForward=False,
    )
    return items[:limit]


# ---------------- 通報 ----------------

def put_report(report):
    report_id = report["reportId"]
    item = dict(report)
    item["PK"] = f"REPORT#{report_id}"
    item["SK"] = "META"
    table().put_item(Item=item)

    target_key = {"PK": "USER#" + report["targetUserId"], "SK": "PROFILE"}
    res = table().update_item(
        Key=target_key,
        UpdateExpression="ADD reportCount :one",
        ExpressionAttributeValues={":one": 1},
        ReturnValues="UPDATED_NEW",
    )
    count = int(res["Attributes"]["reportCount"])
    suspended = count >= SUSPEND_THRESHOLD
    if suspended:
        table().update_item(
            Key=target_key,
            UpdateExpression="SET #s = :s",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":s": "SUSPENDED"},
        )
    return {"reportId": report_id, "reportCount": count, "suspended": suspended}


# ---------------- トークのメッセージ ----------------

def put_message(thread_id, message, thread_prefix="MATCH"):
    """メッセージ本体を保存し、スレッド側にも最新の 1 件を写す（一覧表示用）。

    thread_prefix は 1 対 1 のマッチなら MATCH、環状交換のグループなら GMATCH。
    """
    item = dict(message)
    item["PK"] = f"MSG#{thread_id}"
    item["SK"] = message["messageId"]      # new_id() は時系列に並ぶ
    item["ttl"] = ttl_after_days(MESSAGE_TTL_DAYS)
    table().put_item(Item=item)

    table().update_item(
        Key={"PK": f"{thread_prefix}#{thread_id}", "SK": "META"},
        UpdateExpression=(
            "SET lastMessageAt = :t, lastMessageBy = :u, lastMessagePreview = :p"
        ),
        ExpressionAttributeValues={
            ":t": message["createdAt"],
            ":u": message["senderId"],
            ":p": (message.get("text") or PREVIEW_BY_KIND.get(
                message.get("kind"), ""))[:60],
        },
    )
    return item


def list_messages(match_id, after=None, limit=200):
    """after を渡すとそれより後だけ返す（ポーリングの差分取得用）。"""
    cond = Key("PK").eq(f"MSG#{match_id}")
    if after:
        cond = cond & Key("SK").gt(after)
    items = _query_all(KeyConditionExpression=cond, ScanIndexForward=True)
    return items[-limit:]


def mark_read(match_id, user_id, at):
    """自分の既読時刻を進める。相手には見せない。"""
    table().update_item(
        Key={"PK": f"USER#{user_id}", "SK": f"MATCH#{match_id}"},
        UpdateExpression="SET lastReadAt = :t",
        ExpressionAttributeValues={":t": at},
    )


def claim_message_notify(match_id, cooldown=NOTIFY_COOLDOWN_SEC):
    """直近に通知済みなら False。連投で Push を撃ち尽くさないための間引き。"""
    match = get_match(match_id)
    if not match:
        return False

    now = time.time()
    last = match.get("lastNotifiedAt")
    if last is not None and now - float(last) < cooldown:
        return False

    table().update_item(
        Key={"PK": f"MATCH#{match_id}", "SK": "META"},
        UpdateExpression="SET lastNotifiedAt = :n",
        ExpressionAttributeValues={":n": int(now)},
    )
    return True


# ---------------- タグの共起（おすすめ用） ----------------

def record_cooccurrence(tag_ids):
    """同じカードに一緒に使われたタグ同士の回数を数える。

    「プロセカ」と「天馬司」が繰り返し一緒に出れば関連が強い、とみなす。
    これを使っておすすめの興味を広げる（Embedding の軽量な代わり）。
    """
    tags = sorted(set(tag_ids))
    if len(tags) < 2:
        return
    for i, left in enumerate(tags):
        for right in tags[i + 1:]:
            for a, b in ((left, right), (right, left)):
                table().update_item(
                    Key={"PK": f"COOC#{a}", "SK": b},
                    UpdateExpression="SET tagId = :b ADD hits :one",
                    ExpressionAttributeValues={":b": b, ":one": 1},
                )


def related_tags(tag_id, limit=5):
    """一緒に使われることが多いタグを回数の多い順に返す。"""
    items = _query_all(KeyConditionExpression=Key("PK").eq(f"COOC#{tag_id}"))
    items.sort(key=lambda i: -int(i.get("hits") or 0))
    return [(i["SK"], int(i.get("hits") or 0)) for i in items[:limit]]


# ---------------- 好きな作品 ----------------

def set_home_location(user_id, location):
    """拠点。位置つきカードが無くても距離で並べられるようにする。"""
    if location:
        table().update_item(
            Key={"PK": f"USER#{user_id}", "SK": "PROFILE"},
            UpdateExpression="SET homeLocation = :l, updatedAt = :u",
            ExpressionAttributeValues={":l": location, ":u": now_iso()},
        )
    else:
        table().update_item(
            Key={"PK": f"USER#{user_id}", "SK": "PROFILE"},
            UpdateExpression="REMOVE homeLocation SET updatedAt = :u",
            ExpressionAttributeValues={":u": now_iso()},
        )


def set_favorites(user_id, tag_ids, labels):
    table().update_item(
        Key={"PK": f"USER#{user_id}", "SK": "PROFILE"},
        UpdateExpression="SET favoriteTags = :t, favoriteLabels = :l, updatedAt = :u",
        ExpressionAttributeValues={":t": tag_ids, ":l": labels, ":u": now_iso()},
    )


# ---------------- 新着フィード ----------------

def feed_cards(days=7, limit=200):
    """直近の新着カードを新しい順に。GSI2 は日付で分かれている。"""
    import datetime

    today = datetime.datetime.now(datetime.timezone.utc).date()
    items = []
    for back in range(days):
        day = (today - datetime.timedelta(days=back)).isoformat()
        items.extend(_query_all(
            IndexName="GSI2",
            KeyConditionExpression=Key("GSI2PK").eq(f"FEED#{day}"),
            ScanIndexForward=False,
        ))
        if len(items) >= limit:
            break
    items.sort(key=lambda c: str(c.get("createdAt") or ""), reverse=True)
    return items[:limit]


def cards_in_cells(cells):
    """geohash セルの一覧に含まれるカードを集める。"""
    found = []
    for cell in cells:
        found.extend(_query_all(
            IndexName="GSI3",
            KeyConditionExpression=Key("GSI3PK").eq(f"GEO#{cell}"),
        ))
    return found


# ---------------- スワイプの結果 ----------------

def put_swipe(user_id, card_id, action):
    """SAVED か SKIP を記録する。同じカードは二度出さない。"""
    prefix = "SAVED" if action == "save" else "SKIP"
    item = {
        "PK": f"USER#{user_id}", "SK": f"{prefix}#{card_id}",
        "cardId": card_id, "action": action, "createdAt": now_iso(),
    }
    if action != "save":
        # 見送りは永久に残す必要がないので 60 日で消す
        item["ttl"] = ttl_after_days(60)
    table().put_item(Item=item)
    return item


def swiped_card_ids(user_id):
    """すでに保存 or 見送り済みのカード ID。フィードから外すのに使う。"""
    done = set()
    for prefix in ("SAVED#", "SKIP#"):
        for item in _query_all(
            KeyConditionExpression=Key("PK").eq(f"USER#{user_id}")
            & Key("SK").begins_with(prefix)
        ):
            done.add(item["cardId"])
    return done


def list_saved(user_id):
    refs = _query_all(
        KeyConditionExpression=Key("PK").eq(f"USER#{user_id}") & Key("SK").begins_with("SAVED#"),
        ScanIndexForward=False,
    )
    cards = []
    for ref in refs:
        card = get_card(ref["cardId"])
        if card:
            cards.append(card)
    return cards


def remove_saved(user_id, card_id):
    table().delete_item(Key={"PK": f"USER#{user_id}", "SK": f"SAVED#{card_id}"})


# ---------------- 環状交換のグループ ----------------

def get_group(group_id):
    res = table().get_item(Key={"PK": f"GMATCH#{group_id}", "SK": "META"})
    return res.get("Item")


def save_group(group):
    """既にあれば False。同じ輪を二度提案しないため。"""
    group_id = group["groupId"]
    item = dict(group)
    item["PK"] = f"GMATCH#{group_id}"
    item["SK"] = "META"
    try:
        table().put_item(Item=item, ConditionExpression="attribute_not_exists(PK)")
    except table().meta.client.exceptions.ConditionalCheckFailedException:
        return False

    with table().batch_writer() as batch:
        for member in group["members"]:
            batch.put_item(Item={
                "PK": f"USER#{member}", "SK": f"GMATCH#{group_id}",
                "groupId": group_id,
                "length": group["length"],
                "status": group["status"],
                "createdAt": group["createdAt"],
            })
    return True


def list_groups(user_id):
    refs = _query_all(
        KeyConditionExpression=Key("PK").eq(f"USER#{user_id}") & Key("SK").begins_with("GMATCH#"),
        ScanIndexForward=False,
    )
    out = []
    for ref in refs:
        group = get_group(ref["groupId"])
        if group:
            group["myLastReadAt"] = ref.get("lastReadAt")
            out.append(group)
    return out


def set_group_response(group_id, user_id, answer):
    """accept / decline を記録する。全員そろったかを返す。"""
    group = get_group(group_id)
    if not group:
        raise ApiError(404, "グループが見つかりません", "not_found")
    if user_id not in group["members"]:
        raise ApiError(403, "このグループの参加者ではありません", "forbidden")
    if group.get("status") == "DECLINED":
        raise ApiError(409, "このグループは解散済みです", "declined")

    responses = dict(group.get("responses") or {})
    responses[user_id] = answer

    status = group.get("status") or "NEW"
    if answer == "decline":
        # 1 人でも抜けたら輪が閉じないので解散
        status = "DECLINED"
    elif all(responses.get(m) == "accept" for m in group["members"]):
        status = "ACCEPTED"

    table().update_item(
        Key={"PK": f"GMATCH#{group_id}", "SK": "META"},
        UpdateExpression="SET responses = :r, #s = :s, updatedAt = :u",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":r": responses, ":s": status, ":u": now_iso()},
    )
    for member in group["members"]:
        table().update_item(
            Key={"PK": f"USER#{member}", "SK": f"GMATCH#{group_id}"},
            UpdateExpression="SET #s = :s",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":s": status},
        )

    group["responses"] = responses
    group["status"] = status
    return group


def update_group_status(group_id, status):
    table().update_item(
        Key={"PK": f"GMATCH#{group_id}", "SK": "META"},
        UpdateExpression="SET #s = :s, updatedAt = :u",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":s": status, ":u": now_iso()},
    )
    group = get_group(group_id)
    for member in group["members"]:
        table().update_item(
            Key={"PK": f"USER#{member}", "SK": f"GMATCH#{group_id}"},
            UpdateExpression="SET #s = :s",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":s": status},
        )
    return group


def mark_group_read(group_id, user_id, at):
    table().update_item(
        Key={"PK": f"USER#{user_id}", "SK": f"GMATCH#{group_id}"},
        UpdateExpression="SET lastReadAt = :t",
        ExpressionAttributeValues={":t": at},
    )


def claim_group_notify(group_id, cooldown=NOTIFY_COOLDOWN_SEC):
    group = get_group(group_id)
    if not group:
        return False
    now = time.time()
    last = group.get("lastNotifiedAt")
    if last is not None and now - float(last) < cooldown:
        return False
    table().update_item(
        Key={"PK": f"GMATCH#{group_id}", "SK": "META"},
        UpdateExpression="SET lastNotifiedAt = :n",
        ExpressionAttributeValues={":n": int(now)},
    )
    return True
