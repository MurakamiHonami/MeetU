"""タグ一致エンジン。

スコアや％は出さない。出すのは「何個のタグが一致したか」と「一致したタグそのもの」。
候補抽出は TAGIDX を Query するだけなので、テーブル全体を舐める必要がない。
"""

from collections import defaultdict

import db
import geo

# 誰と誰がマッチしうるか
COUNTERPART = {
    "GIVE": ("WANT",),
    "WANT": ("GIVE",),
    "COMPANION": ("COMPANION",),
}

MAX_CANDIDATES = 100   # 1 回のマッチングで詳細判定するカードの上限
# この距離までは「近い相手」として距離を優先する。これより遠いと
# 距離の差はあまり意味がないので、タグの一致数で並べる
NEAR_LIMIT_KM = 50.0


def _dates_ok(card_a, card_b):
    """同行の日程。両方が指定しているときだけ、重なりを要求する。"""
    dates_a = set(card_a.get("dates") or [])
    dates_b = set(card_b.get("dates") or [])
    if not dates_a or not dates_b:
        return True
    return bool(dates_a & dates_b)


def _point_of(card, user):
    """距離の基準。カードに位置があればそれ、無ければ持ち主の拠点。"""
    return card.get("location") or (user or {}).get("homeLocation")


def _distance_between(my_point, their_point):
    """両方に位置があるときだけ km を返す。片方でも無ければ None。"""
    if not my_point or not their_point:
        return None
    return geo.distance_km(
        float(my_point["lat"]), float(my_point["lon"]),
        float(their_point["lat"]), float(their_point["lon"]),
    )


def _rank_key(hit):
    """条件を満たした候補の並び順。

    近くにいる相手を最優先する。距離が分かる相手（かつ近い相手）を先に置き、
    その中は近い順。距離が分からない・遠すぎる相手は後ろでタグ一致数順にする。
    """
    distance = hit.get("distanceKm")
    if distance is not None and distance <= NEAR_LIMIT_KM:
        return (0, distance, -hit["matchCount"])
    return (1, 0.0, -hit["matchCount"])


def satisfies(want_card, give_card):
    """give_card が want_card の求める条件を満たすか。満たせば一致タグを返す。

    タグ索引を引かずカード同士を直接比べるので、お返しの確認に使っても軽い。
    """
    if want_card.get("type") != "WANT" or want_card.get("status") != "OPEN":
        return None
    if give_card.get("type") != "GIVE" or give_card.get("status") != "OPEN":
        return None
    if want_card.get("ownerId") == give_card.get("ownerId"):
        return None

    want_tags = set(want_card.get("tags") or [])
    give_tags = set(give_card.get("tags") or [])
    matched = want_tags & give_tags

    if len(matched) < int(want_card.get("minMatchCount") or 1):
        return None
    if not set(want_card.get("requiredTags") or []) <= give_tags:
        return None
    if not _dates_ok(want_card, give_card):
        return None
    return matched


def find_handover(giver_cards, receiver_cards):
    """渡す側のカードのうち、受け取る側の希望を満たすものを 1 組返す。

    一致タグが多い組を選ぶ（どうせ渡すなら希望に近い方がよい）。
    """
    best = None
    for give in giver_cards:
        for want in receiver_cards:
            matched = satisfies(want, give)
            if not matched:
                continue
            if best is None or len(matched) > len(best["matchedTags"]):
                best = {
                    "giveCardId": give["cardId"],
                    "wantCardId": want["cardId"],
                    "giveTitle": give.get("title"),
                    "matchedTags": sorted(matched),
                    "labels": {**(give.get("tagLabels") or {}),
                               **(want.get("tagLabels") or {})},
                }
    return best


def _required_ok(owner_card, other_card):
    """owner_card が必須指定したタグを、other_card が全部持っているか。"""
    required = set(owner_card.get("requiredTags") or [])
    return required <= set(other_card.get("tags") or [])


def _labels(card_a, card_b, tag_ids):
    """一致タグの表示名。カードに保存済みのラベルから引く（追加の読み取り不要）。"""
    labels = {}
    labels.update(card_b.get("tagLabels") or {})
    labels.update(card_a.get("tagLabels") or {})
    return [labels.get(t, t) for t in tag_ids]


def find_candidates(card, limit=MAX_CANDIDATES, me=None):
    """カードにタグ一致する相手を探す。

    戻り値は一致タグ数の多い順:
      {card, matchedTags, matchedLabels, matchCount, forMe, forPartner, owner}
      forMe      … 自分のしきい値・必須タグを満たしたか（＝自分に通知してよい）
      forPartner … 相手のしきい値・必須タグを満たしたか（＝相手に通知してよい）
    """
    types = COUNTERPART.get(card["type"])
    if not types:
        return []

    # 1) タグ索引を引いて、カードごとに一致タグを集める
    hits_by_card = defaultdict(set)
    for tag in card.get("tags", []):
        for hit in db.cards_by_tag(tag, types):
            if hit.get("ownerId") == card["ownerId"]:
                continue   # 自分のカード同士はマッチさせない
            hits_by_card[hit["cardId"]].add(tag)

    # 2) 一致数の多い順に、詳細判定する分だけ絞る
    ranked = sorted(hits_by_card.items(), key=lambda kv: -len(kv[1]))[:limit]

    my_min = int(card.get("minMatchCount") or 1)
    my_tags = set(card.get("tags") or [])
    users = {}
    results = []

    # 自分の基準点。カードに位置が無ければプロフィールの拠点を使う
    me = me if me is not None else db.get_user(card["ownerId"])
    my_point = _point_of(card, me)

    for card_id, matched in ranked:
        other = db.get_card(card_id)
        if not other or other.get("status") != "OPEN":
            continue
        if not _dates_ok(card, other):
            continue

        owner_id = other["ownerId"]
        if owner_id not in users:
            users[owner_id] = db.get_user(owner_id)
        owner = users[owner_id]
        if db.is_blocked(owner):
            continue   # 通報により停止中のユーザーは候補から外す

        count = len(matched)
        for_me = count >= my_min and _required_ok(card, other)
        for_partner = (
            count >= int(other.get("minMatchCount") or 1)
            and set(other.get("requiredTags") or []) <= my_tags
        )
        if not (for_me or for_partner):
            continue

        tag_ids = sorted(matched)
        distance = _distance_between(my_point, _point_of(other, owner))
        hit = {
            "card": other,
            "matchedTags": tag_ids,
            "matchedLabels": _labels(card, other, tag_ids),
            "matchCount": count,
            "forMe": for_me,
            "forPartner": for_partner,
            "owner": db.public_user(owner),
        }
        if distance is not None:
            hit["distanceKm"] = round(distance, 2)
            hit["distanceLabel"] = geo.format_distance(distance)
        results.append(hit)

    # 条件を満たした中では、近い相手を先に出す
    results.sort(key=_rank_key)
    return results


def _open_cards(user_id, cache):
    if user_id not in cache:
        cache[user_id] = [
            c for c in db.list_user_cards(user_id) if c.get("status") == "OPEN"
        ]
    return cache[user_id]


def _run_companion(card, notifier=None):
    """同行者募集どうしのマッチ。

    こちらは物のやり取りではなく「一緒に行く」だけなので、相互交換は求めない。
    片方のしきい値を満たしていれば、その人にとっては有益な情報になる。
    """
    from common import now_iso

    created = []
    for hit in find_candidates(card):
        other = hit["card"]
        match_id = db.match_id_for(card["cardId"], other["cardId"])
        match = {
            "matchId": match_id,
            "distanceKm": hit.get("distanceKm"),
            "distanceLabel": hit.get("distanceLabel"),
            "cardAId": card["cardId"], "cardBId": other["cardId"],
            "userAId": card["ownerId"], "userBId": other["ownerId"],
            "matchedTags": hit["matchedTags"],
            "matchedLabels": hit["matchedLabels"],
            "matchCount": hit["matchCount"],
            "kind": "COMPANION",
            "status": "NEW",
            "createdAt": now_iso(),
        }
        if not db.save_match(match):
            continue

        targets = []
        if hit["forMe"]:
            targets.append((card["ownerId"], other))
        if hit["forPartner"]:
            targets.append((other["ownerId"], card))
        created.append({"match": match, "targets": targets, "hit": hit})

        if notifier:
            for user_id, shown_card in targets:
                notifier(user_id, shown_card, hit["matchedLabels"], match_id, hit)
    return created


def run(card, notifier=None):
    """カード登録直後に呼ぶ。成立したマッチを保存し、通知対象を返す。

    金銭のやり取りをしないので、片方だけが受け取る関係は成立させない。
    お互いに相手の希望を満たすカードを出しているときだけマッチにする
    （3 人以上で持ち回る場合は環状交換 cycles.py が受け持つ）。
    同じカードの組み合わせは matchId が同じになるので、二重に通知されない。
    """
    from common import now_iso

    if card["type"] == "COMPANION":
        # 同行はモノの交換ではないので、相互性を求めない
        return _run_companion(card, notifier)

    my_id = card["ownerId"]
    cards_cache = {}
    my_cards = _open_cards(my_id, cards_cache)

    created = []
    checked_partners = set()

    for hit in find_candidates(card):
        partner_id = hit["card"]["ownerId"]
        if partner_id in checked_partners:
            continue   # 相手ごとに 1 回だけ判定すればよい
        checked_partners.add(partner_id)

        their_cards = _open_cards(partner_id, cards_cache)

        # 双方向に成立するか。片方でも欠けたら交換にならない
        i_give = find_handover(my_cards, their_cards)
        they_give = find_handover(their_cards, my_cards)
        if not (i_give and they_give):
            continue

        match_id = db.match_id_for(i_give["giveCardId"], they_give["giveCardId"])
        labels = {**they_give["labels"], **i_give["labels"]}
        received = they_give["matchedTags"]

        match = {
            "matchId": match_id,
            "distanceKm": hit.get("distanceKm"),
            "distanceLabel": hit.get("distanceLabel"),
            # cardA = A が渡すカード / cardB = B が渡すカード
            "cardAId": i_give["giveCardId"], "cardBId": they_give["giveCardId"],
            "userAId": my_id, "userBId": partner_id,
            "exchange": {
                "aGives": i_give["giveCardId"], "aGivesTags": i_give["matchedTags"],
                "bGives": they_give["giveCardId"], "bGivesTags": they_give["matchedTags"],
            },
            "matchedTags": received,
            "matchedLabels": [labels.get(t, t) for t in received],
            "matchCount": len(received),
            "status": "NEW",
            "createdAt": now_iso(),
        }
        if not db.save_match(match):
            continue   # 既に成立済み = 通知済み

        # 双方が得るので、両方に知らせる
        their_card = db.get_card(they_give["giveCardId"])
        my_card = db.get_card(i_give["giveCardId"])
        targets = [(my_id, their_card), (partner_id, my_card)]
        created.append({
            "match": match,
            "targets": targets,
            "hit": {**hit, "card": their_card, "forMe": True, "forPartner": True,
                    "matchedLabels": match["matchedLabels"],
                    "matchCount": match["matchCount"]},
        })

        if notifier:
            for user_id, shown_card in targets:
                tags = (
                    match["matchedLabels"] if user_id == my_id
                    else [labels.get(t, t) for t in i_give["matchedTags"]]
                )
                notifier(user_id, shown_card, tags, match_id, hit)
    return created
