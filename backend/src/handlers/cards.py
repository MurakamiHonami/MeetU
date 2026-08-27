"""カードの登録・検索・取得・クローズ。

カードは 3 種類:
  GIVE      【譲】     グッズを譲りたい      → WANT とマッチ
  WANT      【求】     グッズが欲しい        → GIVE とマッチ
  COMPANION 【同行者求】イベント同行者募集    → COMPANION とマッチ
"""

import re
from collections import defaultdict

import cycles
import db
import geo
import matching
import notify
import tags as tagutil
from common import ApiError, new_id, now_iso, response

CARD_TYPES = ("GIVE", "WANT", "COMPANION")
MAX_TITLE = 60
MAX_NOTE = 500
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


# ---------------- 表示用 ----------------

def card_view(card, owner=None, matched_tags=None):
    labels = card.get("tagLabels") or {}
    view = {
        "cardId": card["cardId"],
        "type": card["type"],
        "title": card.get("title"),
        "note": card.get("note"),
        "tags": [{"tagId": t, "name": labels.get(t, t)} for t in card.get("tags", [])],
        "requiredTags": list(card.get("requiredTags") or []),
        "minMatchCount": int(card.get("minMatchCount") or 1),
        "status": card.get("status"),
        "createdAt": card.get("createdAt"),
    }
    if card.get("dates"):
        view["dates"] = list(card["dates"])
    if card.get("location"):
        view["location"] = geo.location_view(card["location"])
    if owner:
        view["owner"] = owner
    if matched_tags is not None:
        view["matchedTags"] = [labels.get(t, t) for t in matched_tags]
        view["matchCount"] = len(matched_tags)
    return view


# ---------------- バリデーション ----------------

def _int_or_none(value, field):
    if value is None or value == "":
        return None
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise ApiError(400, f"{field} は数値で指定してください", "invalid_number")
    if number < 0:
        raise ApiError(400, f"{field} は 0 以上で指定してください", "invalid_number")
    return number


def _validate_dates(raw):
    if not raw:
        return []
    if not isinstance(raw, list):
        raise ApiError(400, "dates は配列で指定してください", "invalid_dates")
    for date in raw:
        if not isinstance(date, str) or not DATE_RE.match(date):
            raise ApiError(400, f"日付「{date}」は YYYY-MM-DD 形式で指定してください", "invalid_dates")
    return sorted(set(raw))


def _build_card(body, owner_id):
    card_type = body.get("type")
    if card_type not in CARD_TYPES:
        raise ApiError(400, f"type は {'/'.join(CARD_TYPES)} のいずれかです", "invalid_type")

    title = (body.get("title") or "").strip()
    if not title:
        raise ApiError(400, "タイトルを入力してください", "invalid_title")
    if len(title) > MAX_TITLE:
        raise ApiError(400, f"タイトルは{MAX_TITLE}文字以内にしてください", "invalid_title")

    note = (body.get("note") or "").strip()[:MAX_NOTE]

    parsed = tagutil.parse(body.get("tags"))
    if not parsed:
        raise ApiError(400, "タグを 1 つ以上指定してください", "no_tags")

    # 必須タグは検索対象でもあるので、tags 側に無ければ足しておく
    required = tagutil.parse(body.get("requiredTags"), field="requiredTags")
    known = {t["tagId"] for t in parsed}
    for tag in required:
        if tag["tagId"] not in known:
            parsed.append(tag)
            known.add(tag["tagId"])
    if len(parsed) > tagutil.MAX_TAGS:
        raise ApiError(400, f"タグは{tagutil.MAX_TAGS}個までです", "too_many_tags")

    tag_ids = [t["tagId"] for t in parsed]
    labels = {t["tagId"]: t["displayName"] for t in parsed}

    # 「◯件以上一致で通知」。既定は 2（タグが 1 つしかなければ 1）
    default_min = min(2, len(tag_ids))
    min_match = _int_or_none(body.get("minMatchCount"), "minMatchCount")
    if min_match is None:
        min_match = default_min
    min_match = max(1, min(min_match, len(tag_ids)))

    required_ids = [t["tagId"] for t in required]
    if len(required_ids) > min_match:
        # 必須タグの数がしきい値を超えると、しきい値の方が実質無意味になる
        min_match = len(required_ids)

    card = {
        "cardId": new_id(),
        "ownerId": owner_id,
        "type": card_type,
        "title": title,
        "note": note,
        "tags": tag_ids,
        "tagLabels": labels,
        "requiredTags": required_ids,
        "minMatchCount": min_match,
        "status": "OPEN",
        "createdAt": now_iso(),
    }

    location = geo.parse_location(body.get("location"))
    if location:
        card["location"] = location

    dates = _validate_dates(body.get("dates"))
    if card_type == "COMPANION":
        if not dates:
            raise ApiError(400, "同行者募集は日程を 1 日以上指定してください", "no_dates")
        card["dates"] = dates
    elif dates:
        card["dates"] = dates

    return card, parsed


# ---------------- エンドポイント ----------------

def create(ctx):
    user = db.ensure_user(ctx["user"])
    if db.is_blocked(user):
        raise ApiError(403, "通報が重なったため現在ご利用いただけません", "suspended")

    card, parsed_tags = _build_card(ctx["body"], user["userId"])
    tagutil.register(parsed_tags, db)
    db.record_cooccurrence(card["tags"])   # おすすめの意味拡張に使う
    db.put_card(card)

    # 登録直後に双方向マッチング。成立したぶんだけ Push を送る
    def notifier(user_id, shown_card, matched_labels, match_id, hit=None):
        owner = db.public_user(db.get_user(shown_card["ownerId"]))
        notify.notify_match(
            user_id, shown_card, matched_labels, match_id, owner,
            distance=(hit or {}).get("distanceLabel"),
        )

    created = matching.run(card, notifier=notifier)
    groups = _find_groups(card, user)

    return response(201, {
        "card": card_view(card),
        "newGroups": groups,
        "newMatches": [
            {
                "matchId": item["match"]["matchId"],
                "matchCount": item["match"]["matchCount"],
                "matchedTags": item["match"]["matchedLabels"],
                "card": card_view(item["hit"]["card"], owner=item["hit"]["owner"]),
                "notified": bool(item["targets"]),
            }
            for item in created if item["hit"]["forMe"]
        ],
    })


def _find_groups(card, user):
    """1 対 1 で成立しなくても、輪にすれば成立する組み合わせを探して提案する。"""
    from handlers import groups as groups_handler

    if card["type"] != "GIVE":
        return []   # 輪の探索は「出せるもの」を起点にする

    proposals = []
    for cycle in cycles.find_cycles(card):
        group = groups_handler.build(cycle, user["userId"])
        if not db.save_group(group):
            continue   # 同じ輪は提案済み

        notify.notify_group(group)
        proposals.append(groups_handler.view(group, user["userId"]))
    return proposals


def search(ctx):
    """タグ検索。?tags=プロセカ,天馬司&type=GIVE&minMatch=2"""
    user_id = ctx["user"]["userId"]
    raw = (ctx["query"].get("tags") or "").strip()
    if not raw:
        raise ApiError(400, "検索するタグを指定してください", "no_tags")

    parsed = tagutil.parse([t for t in raw.split(",") if t.strip()])
    tag_ids = [t["tagId"] for t in parsed]

    card_type = ctx["query"].get("type")
    if card_type and card_type not in CARD_TYPES:
        raise ApiError(400, f"type は {'/'.join(CARD_TYPES)} のいずれかです", "invalid_type")
    types = (card_type,) if card_type else CARD_TYPES

    min_match = _int_or_none(ctx["query"].get("minMatch"), "minMatch") or 1
    min_match = max(1, min(min_match, len(tag_ids)))

    hits = defaultdict(set)
    for tag in tag_ids:
        for hit in db.cards_by_tag(tag, types):
            if hit.get("ownerId") == user_id:
                continue
            hits[hit["cardId"]].add(tag)

    ranked = sorted(
        ((cid, matched) for cid, matched in hits.items() if len(matched) >= min_match),
        key=lambda kv: -len(kv[1]),
    )[:50]

    owners, results = {}, []
    for card_id, matched in ranked:
        card = db.get_card(card_id)
        if not card or card.get("status") != "OPEN":
            continue
        owner_id = card["ownerId"]
        if owner_id not in owners:
            owners[owner_id] = db.get_user(owner_id)
        if db.is_blocked(owners[owner_id]):
            continue
        results.append(card_view(card, db.public_user(owners[owner_id]), sorted(matched)))

    return response(200, {"cards": results, "query": {
        "tags": [{"tagId": t["tagId"], "name": t["displayName"]} for t in parsed],
        "type": card_type, "minMatch": min_match,
    }})


def mine(ctx):
    cards = db.list_user_cards(ctx["user"]["userId"])
    return response(200, {"cards": [card_view(c) for c in cards]})


def get_one(ctx, card_id):
    card = db.get_card(card_id)
    if not card:
        raise ApiError(404, "カードが見つかりません", "not_found")
    owner = db.get_user(card["ownerId"])
    return response(200, {"card": card_view(card, db.public_user(owner))})


def close(ctx, card_id):
    card = db.close_card(card_id, ctx["user"]["userId"])
    return response(200, {"card": card_view(card)})


def candidates(ctx, card_id):
    """自分のカードにタグ一致する相手を一覧する（「募集を探す」の主導線）。"""
    card = db.get_card(card_id)
    if not card:
        raise ApiError(404, "カードが見つかりません", "not_found")
    if card["ownerId"] != ctx["user"]["userId"]:
        raise ApiError(403, "自分のカードのみ参照できます", "forbidden")

    found = matching.find_candidates(card)
    return response(200, {
        "cards": [
            {
                **card_view(hit["card"], owner=hit["owner"]),
                "matchedTags": hit["matchedLabels"],
                "matchCount": hit["matchCount"],
                "distanceKm": hit.get("distanceKm"),
                "distanceLabel": hit.get("distanceLabel"),
            }
            for hit in found
        ],
        "minMatchCount": int(card.get("minMatchCount") or 1),
    })
