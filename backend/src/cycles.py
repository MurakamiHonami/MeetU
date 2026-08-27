"""環状交換（3人以上での持ち回り交換）の検出。

1 対 1 では成立しない組み合わせでも、輪にすれば全員の希望が満たせることがある。

    A: 譲=五条 / 求=夏油
    B: 譲=夏油 / 求=伏黒
    C: 譲=伏黒 / 求=五条

    A ──五条──▶ C ──伏黒──▶ B ──夏油──▶ A

「相互に欲しいものを持つ 2 人」ではなく「交換の循環」を探す。

有向グラフの閉路探索として解く:
  ノード … ユーザー
  辺 X→Y … X が出せるカードが、Y の求める条件を満たしている
探索は深さ・分岐・訪問数に上限を設けて打ち切る（全閉路の列挙は組合せ爆発するため）。
"""

import hashlib

import db
import matching

MAX_CYCLE = 4        # 4 人までの輪を探す。これ以上は成立させるのが現実的でない
MIN_CYCLE = 3        # 2 人の交換は通常のマッチが扱うのでここでは 3 人から
MAX_BRANCH = 5       # 1 ノードから辿る辺の上限（一致数の多い順）
MAX_VISITS = 300     # 探索全体の打ち切り
MAX_RESULTS = 5      # 1 回の登録で提案する輪の数


def group_id_for(card_ids):
    """参加カードの組で決まる ID。同じ輪を何度も作らないための冪等キー。"""
    joined = "_".join(sorted(card_ids))
    return hashlib.sha1(joined.encode("utf-8")).hexdigest()[:20]


def _open_give_cards(user_id, cache):
    """そのユーザーが今出している譲カード。"""
    if user_id in cache:
        return cache[user_id]

    cards = [
        card for card in db.list_user_cards(user_id)
        if card.get("type") == "GIVE" and card.get("status") == "OPEN"
    ]
    cache[user_id] = cards
    return cards


def _outgoing(give_card, edge_cache):
    """この譲カードを受け取れる相手（求カード）を返す。

    向きが肝心で、必要なのは「受け取る側の条件が満たされているか」だけ。
    渡す側が何を欲しいかは、輪の次のステップで評価される。
    """
    card_id = give_card["cardId"]
    if card_id in edge_cache:
        return edge_cache[card_id]

    edges = [
        hit for hit in matching.find_candidates(give_card)
        if hit["forPartner"] and hit["card"].get("type") == "WANT"
    ]
    edges.sort(key=lambda h: -h["matchCount"])
    edges = edges[:MAX_BRANCH]
    edge_cache[card_id] = edges
    return edges


def _step(give_card, hit):
    """輪の 1 区間。「誰が誰に、どのカードを渡すか」。"""
    want_card = hit["card"]
    return {
        "fromUserId": give_card["ownerId"],
        "toUserId": want_card["ownerId"],
        "giveCardId": give_card["cardId"],
        "wantCardId": want_card["cardId"],
        "matchedTags": hit["matchedTags"],
        "matchedLabels": hit["matchedLabels"],
        "matchCount": hit["matchCount"],
    }


def find_cycles(start_card, max_len=MAX_CYCLE, limit=MAX_RESULTS):
    """start_card（譲カード）の持ち主を起点に、閉じた交換の輪を探す。

    戻り値は [{groupId, steps, length}]。steps は渡す順に並ぶ。
    """
    if start_card.get("type") != "GIVE" or start_card.get("status") != "OPEN":
        return []

    start_user = start_card["ownerId"]
    give_cache = {start_user: [start_card]}
    edge_cache = {}
    visits = [0]
    found = {}

    def walk(chain):
        if len(found) >= limit or visits[0] >= MAX_VISITS:
            return
        if len(chain) >= max_len:
            return

        current_user = chain[-1]["toUserId"]
        used_users = {step["fromUserId"] for step in chain}

        for give_card in _open_give_cards(current_user, give_cache):
            if visits[0] >= MAX_VISITS:
                return
            visits[0] += 1

            for hit in _outgoing(give_card, edge_cache):
                receiver = hit["card"]["ownerId"]
                step = _step(give_card, hit)

                if receiver == start_user:
                    # 起点まで戻ったら輪が閉じた
                    closed = chain + [step]
                    if len(closed) >= MIN_CYCLE:
                        card_ids = [s["giveCardId"] for s in closed]
                        group_id = group_id_for(card_ids)
                        found.setdefault(group_id, {
                            "groupId": group_id,
                            "steps": closed,
                            "length": len(closed),
                        })
                    continue

                if receiver in used_users:
                    continue   # 同じ人を二度通らない

                walk(chain + [step])

    for hit in _outgoing(start_card, edge_cache):
        if hit["card"]["ownerId"] == start_user:
            continue
        walk([_step(start_card, hit)])

    # 短い輪ほど成立しやすいので前に出す
    return sorted(found.values(), key=lambda g: g["length"])[:limit]


def describe(steps, user_id):
    """自分から見た説明。「誰に渡して、誰から受け取るか」。"""
    gives_to = next((s for s in steps if s["fromUserId"] == user_id), None)
    receives = next((s for s in steps if s["toUserId"] == user_id), None)
    return {"gives": gives_to, "receives": receives}
