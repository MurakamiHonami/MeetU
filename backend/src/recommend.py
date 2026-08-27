"""おすすめ順の並べ替え。

外部の埋め込み API は使わず、タグを次元とみなしたベクトルの類似度で計算する。
  ・興味ベクトル … 登録した好きな作品 + 自分が出しているカードのタグ
  ・共起で拡張   … よく一緒に使われるタグにも部分点を入れて「意味の近さ」を作る
  ・珍しいタグを重く … 全員が付ける「プロセカ」より「天馬司」の一致を評価する
追加コストもレイテンシもかからず、なぜ薦めたかを言葉で返せるのが利点。
"""

import math

FAVORITE_WEIGHT = 1.0     # 明示的に登録した好きな作品
OWN_CARD_WEIGHT = 0.5     # 自分のカードのタグは補助的に効かせる
EXPAND_WEIGHT = 0.45      # 共起で広げたタグは元より軽く
EXPAND_TOP = 5            # 1 タグにつき広げる数
FRESH_BONUS = 0.15        # 新しいカードを少し前に出す


def _tag_weight(tag_id, db, cache):
    """珍しいタグほど重い（IDF 相当）。"""
    if tag_id in cache:
        return cache[tag_id]
    master = db.get_tag(tag_id) or {}
    uses = int(master.get("useCount") or 0)
    weight = 1.0 / math.log(2.0 + uses)
    cache[tag_id] = weight
    return weight


def build_profile(user_id, db, user=None):
    """そのユーザーの興味ベクトルを作る。{tagId: 重み}"""
    user = user or db.get_user(user_id) or {}
    profile = {}

    for tag in user.get("favoriteTags") or []:
        profile[tag] = max(profile.get(tag, 0.0), FAVORITE_WEIGHT)

    for card in db.list_user_cards(user_id):
        if card.get("status") != "OPEN":
            continue
        for tag in card.get("tags") or []:
            profile[tag] = max(profile.get(tag, 0.0), OWN_CARD_WEIGHT)

    return profile


def expand_profile(profile, db):
    """共起の強いタグを足して興味を広げる。"""
    if not profile:
        return {}

    expanded = dict(profile)
    for tag, weight in list(profile.items()):
        related = db.related_tags(tag, EXPAND_TOP)
        if not related:
            continue
        top_hits = related[0][1] or 1
        for other, hits in related:
            if other in profile:
                continue   # 元から興味があるタグは薄めない
            strength = hits / top_hits
            expanded[other] = max(expanded.get(other, 0.0), weight * strength * EXPAND_WEIGHT)
    return expanded


def score_card(profile, card, db, cache, freshness=0.0):
    """カード 1 枚のおすすめ度。(score, 効いたタグ) を返す。

    freshness は 0〜1（1 が一番新しい）。相性が拮抗したときの並び順に効かせる。
    """
    card_tags = list(card.get("tags") or [])
    if not card_tags or not profile:
        return 0.0, []

    dot = 0.0
    hits = []
    for tag in card_tags:
        interest = profile.get(tag)
        if not interest:
            continue
        weight = _tag_weight(tag, db, cache)
        dot += interest * weight
        # 元から好きなタグだけを理由として見せる（拡張分は理由に出さない）
        if interest >= OWN_CARD_WEIGHT:
            hits.append(tag)

    if dot <= 0:
        return 0.0, []

    # コサイン類似度。タグを盛ったカードが有利にならないよう長さで割る
    card_norm = math.sqrt(sum(_tag_weight(t, db, cache) ** 2 for t in card_tags))
    profile_norm = math.sqrt(sum(w * w for w in profile.values()))
    if card_norm <= 0 or profile_norm <= 0:
        return 0.0, []

    # 同じくらいの相性なら新しいカードを前に
    score = dot / (card_norm * profile_norm) + FRESH_BONUS * freshness
    return score, hits


def rank(cards, user_id, db, user=None, limit=30):
    """カード群をおすすめ順に並べ替える。

    戻り値: [{card, score, reasonTags}]
    興味ベクトルが空（好きな作品もカードも無い）ときは新着順にそのまま返す。
    """
    # 新しい順に並べてから、位置で新しさを 0〜1 に割り当てる
    ordered = sorted(cards, key=lambda c: str(c.get("createdAt") or ""), reverse=True)

    profile = expand_profile(build_profile(user_id, db, user), db)
    if not profile:
        # 興味の手がかりが無いうちは素直に新着順
        return [{"card": c, "score": 0.0, "reasonTags": []} for c in ordered[:limit]]

    span = max(len(ordered) - 1, 1)
    cache = {}
    scored = []
    for index, card in enumerate(ordered):
        freshness = 1.0 - index / span
        score, hits = score_card(profile, card, db, cache, freshness)
        scored.append({"card": card, "score": round(score, 4), "reasonTags": hits})

    # スコア降順。同点なら新しい方（ordered の並びを保つので安定ソートで足りる）
    scored.sort(key=lambda r: -r["score"])
    return scored[:limit]
