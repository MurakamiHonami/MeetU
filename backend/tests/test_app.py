"""タグ一致マッチングの動作確認。

boto3 を使わずインメモリのスタブで動かすので、AWS 無しで実行できる。
  python backend/tests/test_app.py
"""

import json
import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import fake_aws  # noqa: E402

fake_aws.install()
os.environ.setdefault("TABLE_NAME", "TestTable")
os.environ.setdefault("UPLOAD_BUCKET", "TestBucket")

import db            # noqa: E402
import notify        # noqa: E402
import tags as tagutil  # noqa: E402
from common import ApiError  # noqa: E402
import geo           # noqa: E402
import recommend     # noqa: E402
import cycles        # noqa: E402
import matching      # noqa: E402
from handlers import (  # noqa: E402
    cards, feed, groups, matches, me, messages, nearby, reports, reviews, uploads,
)

SENT = []   # (userId, 一致タグ) を記録する


def _fake_notify_match(user_id, card, matched_labels, match_id, owner=None, **kw):
    SENT.append((user_id, list(matched_labels)))
    return True


PUSHED = []   # (userId, messages) を丸ごと記録して中身を検証する


def _fake_push(user_id, messages):
    SENT.append((user_id, "text"))
    PUSHED.append((user_id, messages))
    return True


notify.notify_match = _fake_notify_match
notify.push = _fake_push


# ---------------- テスト補助 ----------------

def reset():
    fake_aws.reset()
    db._table = None
    SENT.clear()
    PUSHED.clear()


def ctx(user_id, body=None, query=None, name=None):
    return {
        "user": {"userId": user_id, "displayName": name or user_id, "pictureUrl": None},
        "body": body or {},
        "query": query or {},
    }


def body_of(res):
    return json.loads(res["body"])


def _built_card(user_id, **payload):
    """保存せずにカードの中身だけ作る。find_candidates を直接試すのに使う。"""
    db.ensure_user({"userId": user_id, "displayName": user_id, "pictureUrl": None})
    card, _ = cards._build_card(payload, user_id)
    return card


def make_card(user_id, **payload):
    res = cards.create(ctx(user_id, payload))
    assert res["statusCode"] == 201, body_of(res)
    return body_of(res)


PASSED, FAILED = [], []


def test(fn):
    reset()
    try:
        fn()
        PASSED.append(fn.__name__)
        print(f"  PASS  {fn.__name__}")
    except AssertionError as e:
        FAILED.append((fn.__name__, str(e)))
        print(f"  FAIL  {fn.__name__}: {e}")
    except Exception as e:
        FAILED.append((fn.__name__, f"{type(e).__name__}: {e}"))
        print(f"  ERROR {fn.__name__}: {type(e).__name__}: {e}")


# ---------------- タグ正規化 ----------------

def test_タグの表記ゆれが同じIDになる():
    assert tagutil.normalize("プロセカ") == tagutil.normalize("ﾌﾟﾛｾｶ")
    assert tagutil.normalize("Project SEKAI") == tagutil.normalize("ｐｒｏｊｅｃｔｓｅｋａｉ")
    assert tagutil.normalize("天馬 司") == tagutil.normalize("天馬司")
    assert tagutil.normalize("アクスタ！") == tagutil.normalize("アクスタ")
    # カタカナとひらがなは別物として残す（意味が変わる語があるため）
    assert tagutil.normalize("プロセカ") != tagutil.normalize("ぷろせか")


def test_記号だけのタグは弾く():
    try:
        tagutil.normalize("！！！")
        assert False, "例外が出るべき"
    except ApiError as e:
        assert e.status == 400


def test_タグは10個まで():
    try:
        tagutil.parse([f"タグ{i}" for i in range(11)])
        assert False, "例外が出るべき"
    except ApiError as e:
        assert e.code == "too_many_tags"


# ---------------- しきい値 ----------------

def test_相互に希望を満たせばマッチして両方に通知される():
    make_card("userA", type="GIVE", title="Aが譲る",
              tags=["プロセカ", "天馬司", "アクスタ"], minMatchCount=1)
    make_card("userA", type="WANT", title="Aが求む",
              tags=["プロセカ", "神代類", "東京都"], minMatchCount=3)
    make_card("userB", type="GIVE", title="Bが譲る",
              tags=["プロセカ", "神代類", "東京都"], minMatchCount=1)
    result = make_card("userB", type="WANT", title="Bが求む",
                       tags=["プロセカ", "天馬司", "アクスタ"], minMatchCount=3)

    assert len(result["newMatches"]) == 1, result["newMatches"]
    # 双方が得るので必ず両方に通知される
    assert {s[0] for s in SENT} == {"userA", "userB"}, SENT


def test_しきい値に届かなければマッチしない():
    make_card("userA", type="WANT", title="求む",
              tags=["プロセカ", "天馬司", "アクスタ"], minMatchCount=3)
    result = make_card("userB", type="GIVE", title="譲",
                       tags=["プロセカ", "神代類", "色紙"], minMatchCount=3)

    assert result["newMatches"] == [], result["newMatches"]
    assert SENT == [], SENT


def test_同行はしきい値を満たした側にだけ通知が飛ぶ():
    # 同行は交換ではないので、片方の条件が合えばその人に知らせる。
    # A は「1件でも一致すれば知りたい」、B は「3件一致しないと要らない」
    make_card("userA", type="COMPANION", title="ゆるく探す",
              tags=["コミケ", "プロセカ", "天馬司"],
              dates=["2026-08-14"], minMatchCount=1)
    make_card("userB", type="COMPANION", title="厳しめ",
              tags=["コミケ", "神代類", "缶バッジ"],
              dates=["2026-08-14"], minMatchCount=3)

    # 一致は「コミケ」の1件のみ → A の条件だけ満たす
    assert [s[0] for s in SENT] == ["userA"], SENT


# ---------------- 必須タグ ----------------

def test_必須タグを相手が持っていなければマッチしない():
    make_card("userA", type="WANT", title="司じゃなきゃ嫌だ",
              tags=["プロセカ", "天馬司", "東京都"],
              requiredTags=["天馬司"], minMatchCount=1)
    result = make_card("userB", type="GIVE", title="類のグッズ",
                       tags=["プロセカ", "神代類", "東京都"], minMatchCount=5)

    # B のしきい値も満たさないので、そもそもマッチが立たない
    assert result["newMatches"] == []
    assert SENT == [], SENT


def test_必須タグを満たせばマッチする():
    make_card("userA", type="GIVE", title="Aが譲る",
              tags=["プロセカ", "神代類"], minMatchCount=1)
    make_card("userA", type="WANT", title="司じゃなきゃ嫌だ",
              tags=["プロセカ", "天馬司", "東京都"],
              requiredTags=["天馬司"], minMatchCount=1)
    make_card("userB", type="GIVE", title="司のアクスタ",
              tags=["プロセカ", "天馬司"], minMatchCount=1)
    make_card("userB", type="WANT", title="Bが求む",
              tags=["プロセカ", "神代類"], minMatchCount=1)

    assert {s[0] for s in SENT} == {"userA", "userB"}, SENT


def test_必須タグは自動でtagsにも入る():
    result = make_card("userA", type="WANT", title="t",
                       tags=["プロセカ"], requiredTags=["天馬司"])
    tag_ids = {t["tagId"] for t in result["card"]["tags"]}
    assert tagutil.normalize("天馬司") in tag_ids, tag_ids


# ---------------- 価格・日程 ----------------

def test_価格を送っても保存されない():
    # 物々交換のみなので、価格の概念はカードに持たせない
    result = make_card("userA", type="GIVE", title="譲ります",
                       tags=["プロセカ", "天馬司"], price=3000, priceMax=5000)
    assert "price" not in result["card"], result["card"]
    assert "priceMax" not in result["card"], result["card"]


def test_同行は日程が重ならないとマッチしない():
    make_card("userA", type="COMPANION", title="1日目",
              tags=["コミケ", "プロセカ"], dates=["2026-08-14"], minMatchCount=1)
    make_card("userB", type="COMPANION", title="2日目",
              tags=["コミケ", "プロセカ"], dates=["2026-08-16"], minMatchCount=1)
    assert SENT == [], SENT


def test_同行は日程が重なればマッチする():
    make_card("userA", type="COMPANION", title="1日目",
              tags=["コミケ", "プロセカ"], dates=["2026-08-14", "2026-08-15"], minMatchCount=1)
    make_card("userB", type="COMPANION", title="2日目も",
              tags=["コミケ", "プロセカ"], dates=["2026-08-15"], minMatchCount=1)
    assert {s[0] for s in SENT} == {"userA", "userB"}, SENT


def test_同行は日程必須():
    try:
        make_card("userA", type="COMPANION", title="いつでも", tags=["コミケ"])
        assert False, "例外が出るべき"
    except ApiError as e:
        assert e.code == "no_dates", e.code


def test_譲と譲はマッチしない():
    make_card("userA", type="GIVE", title="譲1", tags=["プロセカ", "天馬司"], minMatchCount=1)
    make_card("userB", type="GIVE", title="譲2", tags=["プロセカ", "天馬司"], minMatchCount=1)
    assert SENT == [], SENT


def test_自分のカード同士はマッチしない():
    make_card("userA", type="WANT", title="求", tags=["プロセカ", "天馬司"], minMatchCount=1)
    result = make_card("userA", type="GIVE", title="譲", tags=["プロセカ", "天馬司"], minMatchCount=1)
    assert result["newMatches"] == []
    assert SENT == [], SENT


# ---------------- 重複・クローズ ----------------

def test_同じ組み合わせは二重に通知されない():
    _mutual_pair()
    first = len(SENT)

    # 同じ内容をもう一度マッチングにかけても、マッチ ID が同じなので増えない
    import matching
    card_b = db.list_user_cards("userB")[0]
    matching.run(card_b, notifier=_fake_notify_match)
    assert len(SENT) == first, SENT


def test_クローズしたカードは候補から消える():
    made = make_card("userA", type="WANT", title="求", tags=["プロセカ", "天馬司"], minMatchCount=1)
    make_card("userA", type="GIVE", title="Aが譲る", tags=["プロセカ", "神代類"], minMatchCount=1)
    cards.close(ctx("userA"), made["card"]["cardId"])

    make_card("userB", type="GIVE", title="譲", tags=["プロセカ", "天馬司"], minMatchCount=1)
    make_card("userB", type="WANT", title="Bが求む", tags=["プロセカ", "神代類"], minMatchCount=1)
    assert SENT == [], SENT


def test_検索はタグ一致数の多い順に返る():
    make_card("userB", type="GIVE", title="1件一致", tags=["プロセカ", "神代類"], minMatchCount=5)
    make_card("userC", type="GIVE", title="2件一致", tags=["プロセカ", "天馬司"], minMatchCount=5)

    res = cards.search(ctx("userA", query={"tags": "プロセカ,天馬司", "type": "GIVE"}))
    found = body_of(res)["cards"]
    assert [c["title"] for c in found] == ["2件一致", "1件一致"], found
    assert found[0]["matchCount"] == 2


def test_検索のminMatchで絞れる():
    make_card("userB", type="GIVE", title="1件一致", tags=["プロセカ", "神代類"], minMatchCount=5)
    make_card("userC", type="GIVE", title="2件一致", tags=["プロセカ", "天馬司"], minMatchCount=5)

    res = cards.search(ctx("userA", query={"tags": "プロセカ,天馬司", "minMatch": "2"}))
    found = body_of(res)["cards"]
    assert [c["title"] for c in found] == ["2件一致"], found


# ---------------- 評価・通報 ----------------

def _make_completed_match():
    match_id = _accepted_match()
    matches.complete(ctx("userA"), match_id)
    return match_id


def test_双方が承諾して初めてACCEPTEDになる():
    match_id = _new_match()

    first = body_of(matches.accept(ctx("userA"), match_id))
    assert first["bothAccepted"] is False
    assert first["match"]["status"] == "NEW"

    second = body_of(matches.accept(ctx("userB"), match_id))
    assert second["bothAccepted"] is True
    assert second["match"]["status"] == "ACCEPTED"


def test_取引完了後に評価できる():
    match_id = _make_completed_match()
    res = reviews.create(ctx("userA", {"matchId": match_id, "rating": 5, "comment": "丁寧でした"}))
    assert res["statusCode"] == 201, body_of(res)

    profile = db.public_user(db.get_user("userB"))
    assert profile["ratingAvg"] == 5.0, profile
    assert profile["ratingCount"] == 1


def test_同じ取引を二重に評価できない():
    match_id = _make_completed_match()
    reviews.create(ctx("userA", {"matchId": match_id, "rating": 5}))
    try:
        reviews.create(ctx("userA", {"matchId": match_id, "rating": 1}))
        assert False, "例外が出るべき"
    except ApiError as e:
        assert e.code == "already_reviewed", e.code


def test_未完了の取引は評価できない():
    match_id = _new_match()
    try:
        reviews.create(ctx("userA", {"matchId": match_id, "rating": 5}))
        assert False, "例外が出るべき"
    except ApiError as e:
        assert e.code == "not_completed", e.code


def test_通報3件でユーザーが停止しマッチから外れる():
    # 停止される前にカードを出しておく
    make_card("bad", type="GIVE", title="譲", tags=["プロセカ", "天馬司"], minMatchCount=1)
    make_card("bad", type="WANT", title="badが求む",
              tags=["プロセカ", "神代類"], minMatchCount=1)

    for reporter in ("u1", "u2", "u3"):
        db.ensure_user({"userId": reporter, "displayName": reporter})
        reports.create(ctx(reporter, {"targetUserId": "bad", "reason": "FRAUD"}))
    assert db.get_user("bad")["status"] == "SUSPENDED"

    # 既存カードが残っていても、停止ユーザーなら候補に出ない
    SENT.clear()
    make_card("userA", type="GIVE", title="Aが譲る",
              tags=["プロセカ", "神代類"], minMatchCount=1)
    result = make_card("userA", type="WANT", title="求", tags=["プロセカ", "天馬司"], minMatchCount=1)
    assert result["newMatches"] == [], result["newMatches"]
    assert SENT == [], SENT


def test_停止ユーザーはカードを作れない():
    db.ensure_user({"userId": "bad", "displayName": "bad"})
    for reporter in ("u1", "u2", "u3"):
        db.ensure_user({"userId": reporter, "displayName": reporter})
        reports.create(ctx(reporter, {"targetUserId": "bad", "reason": "FRAUD"}))
    try:
        make_card("bad", type="GIVE", title="譲", tags=["プロセカ"], minMatchCount=1)
        assert False, "例外が出るべき"
    except ApiError as e:
        assert e.code == "suspended", e.code


def test_自分自身は通報できない():
    db.ensure_user({"userId": "userA", "displayName": "A"})
    try:
        reports.create(ctx("userA", {"targetUserId": "userA", "reason": "FRAUD"}))
        assert False, "例外が出るべき"
    except ApiError as e:
        assert e.code == "invalid_target", e.code


def test_通報者に停止状態を返さない():
    db.ensure_user({"userId": "bad", "displayName": "bad"})
    db.ensure_user({"userId": "u1", "displayName": "u1"})
    res = body_of(reports.create(ctx("u1", {"targetUserId": "bad", "reason": "FRAUD"})))
    assert "reportCount" not in res and "suspended" not in res, res


# ---------------- トーク ----------------

def _mutual_pair(a="userA", b="userB", tag_a="天馬司", tag_b="神代類"):
    """A と B が互いの希望を満たす状態を作る。

    A: 天馬司を譲る / 神代類が欲しい
    B: 神代類を譲る / 天馬司が欲しい
    最後の 1 枚で相互交換が成立する。
    """
    make_card(a, type="GIVE", title=f"{a}が譲る", tags=["プロセカ", tag_a], minMatchCount=1)
    make_card(a, type="WANT", title=f"{a}が求む", tags=["プロセカ", tag_b], minMatchCount=1)
    make_card(b, type="GIVE", title=f"{b}が譲る", tags=["プロセカ", tag_b], minMatchCount=1)
    return make_card(b, type="WANT", title=f"{b}が求む",
                     tags=["プロセカ", tag_a], minMatchCount=1)


def _new_match():
    """承諾前のマッチを 1 件用意する。"""
    _mutual_pair()
    return db.list_matches("userA")[0]["matchId"]


def _accepted_match():
    """双方が承諾済みのマッチを 1 件用意する。"""
    match_id = _new_match()
    matches.accept(ctx("userA"), match_id)
    matches.accept(ctx("userB"), match_id)
    SENT.clear()
    PUSHED.clear()
    return match_id


def test_承諾前はメッセージを送れない():
    match_id = _new_match()
    try:
        messages.create(ctx("userA", {"text": "はじめまして"}), match_id)
        assert False, "例外が出るべき"
    except ApiError as e:
        assert e.code == "not_accepted", e.code


def test_双方承諾後はメッセージを送れる():
    match_id = _accepted_match()
    res = messages.create(ctx("userA", {"text": "はじめまして！"}), match_id)
    assert res["statusCode"] == 201, body_of(res)

    listed = body_of(messages.list_(ctx("userB"), match_id))
    assert [m["text"] for m in listed["messages"]] == ["はじめまして！"]
    assert listed["canSend"] is True
    # 受け取った側から見ると自分の発言ではない
    assert listed["messages"][0]["mine"] is False


def test_送信者から見た自分の発言はmineになる():
    match_id = _accepted_match()
    messages.create(ctx("userA", {"text": "こんにちは"}), match_id)
    listed = body_of(messages.list_(ctx("userA"), match_id))
    assert listed["messages"][0]["mine"] is True


def test_メッセージは時系列に並ぶ():
    match_id = _accepted_match()
    for text in ("1つめ", "2つめ", "3つめ"):
        messages.create(ctx("userA", {"text": text}), match_id)
    listed = body_of(messages.list_(ctx("userB"), match_id))
    assert [m["text"] for m in listed["messages"]] == ["1つめ", "2つめ", "3つめ"]


def test_afterで差分だけ取れる():
    match_id = _accepted_match()
    messages.create(ctx("userA", {"text": "古い"}), match_id)
    first = body_of(messages.list_(ctx("userB"), match_id))["messages"]
    messages.create(ctx("userA", {"text": "新しい"}), match_id)

    diff = body_of(messages.list_(
        ctx("userB", query={"after": first[-1]["messageId"]}), match_id))
    assert [m["text"] for m in diff["messages"]] == ["新しい"], diff


def test_当事者以外はトークを読めない():
    match_id = _accepted_match()
    messages.create(ctx("userA", {"text": "内緒の話"}), match_id)
    try:
        messages.list_(ctx("userX"), match_id)
        assert False, "例外が出るべき"
    except ApiError as e:
        assert e.code == "forbidden", e.code


def test_空メッセージは送れない():
    match_id = _accepted_match()
    try:
        messages.create(ctx("userA", {"text": "   "}), match_id)
        assert False, "例外が出るべき"
    except ApiError as e:
        assert e.code == "empty_message", e.code


def test_長すぎるメッセージは送れない():
    match_id = _accepted_match()
    try:
        messages.create(ctx("userA", {"text": "あ" * 1001}), match_id)
        assert False, "例外が出るべき"
    except ApiError as e:
        assert e.code == "message_too_long", e.code


def test_連投しても通知は間引かれる():
    match_id = _accepted_match()
    messages.create(ctx("userA", {"text": "1"}), match_id)
    after_first = len(SENT)
    assert after_first == 1, SENT

    # クールダウン中なので追加の Push は飛ばない
    for text in ("2", "3", "4"):
        messages.create(ctx("userA", {"text": text}), match_id)
    assert len(SENT) == after_first, SENT


def test_相手の発言があると未読になる():
    match_id = _accepted_match()
    messages.create(ctx("userB", {"text": "届いてますか"}), match_id)

    mine = body_of(matches.list_all(ctx("userA")))["matches"][0]
    assert mine["hasUnread"] is True, mine
    assert mine["lastMessagePreview"] == "届いてますか"
    # 送った本人は未読にならない
    theirs = body_of(matches.list_all(ctx("userB")))["matches"][0]
    assert theirs["hasUnread"] is False, theirs


def test_トークを開くと未読が消える():
    match_id = _accepted_match()
    messages.create(ctx("userB", {"text": "見て"}), match_id)
    messages.list_(ctx("userA"), match_id)          # 開いた＝既読

    mine = body_of(matches.list_all(ctx("userA")))["matches"][0]
    assert mine["hasUnread"] is False, mine


def test_取引完了後もトークは続けられる():
    match_id = _accepted_match()
    matches.complete(ctx("userA"), match_id)
    res = messages.create(ctx("userA", {"text": "ありがとうございました"}), match_id)
    assert res["statusCode"] == 201, body_of(res)


# ---------------- 位置情報 ----------------

def test_geohashは近い場所ほど前方一致が長い():
    tokyo = geo.encode(35.6812, 139.7671, 6)        # 東京駅
    near = geo.encode(35.6820, 139.7660, 6)         # すぐ近く
    osaka = geo.encode(34.7025, 135.4959, 6)        # 大阪駅
    assert tokyo == near, (tokyo, near)          # 90m 程度なら同じセル
    assert tokyo[:3] != osaka[:3], (tokyo, osaka)  # 日本全体が xn で始まるので 3 文字で見る


def test_距離計算が実測に近い():
    # 東京駅 - 大阪駅 はおよそ 400km
    km = geo.distance_km(35.6812, 139.7671, 34.7025, 135.4959)
    assert 390 < km < 420, km


def test_近くのカードだけが返る():
    make_card("userB", type="GIVE", title="東京駅のカード",
              tags=["プロセカ"], location={"lat": 35.6812, "lon": 139.7671, "name": "東京駅"})
    make_card("userC", type="GIVE", title="大阪駅のカード",
              tags=["プロセカ"], location={"lat": 34.7025, "lon": 135.4959})

    res = body_of(nearby.search(ctx("userA", query={
        "lat": "35.6810", "lon": "139.7670", "radius": "3",
    })))
    titles = [c["title"] for c in res["cards"]]
    assert titles == ["東京駅のカード"], titles
    assert res["cards"][0]["distanceKm"] < 0.5
    assert res["cards"][0]["location"]["name"] == "東京駅"


def test_位置なしのカードは地図に出ない():
    make_card("userB", type="GIVE", title="位置なし", tags=["プロセカ"])
    res = body_of(nearby.search(ctx("userA", query={"lat": "35.68", "lon": "139.76"})))
    assert res["cards"] == [], res


def test_自分のカードは地図に出ない():
    make_card("userA", type="GIVE", title="自分の",
              tags=["プロセカ"], location={"lat": 35.6812, "lon": 139.7671})
    res = body_of(nearby.search(ctx("userA", query={"lat": "35.6810", "lon": "139.7670"})))
    assert res["cards"] == [], res


def test_不正な緯度経度は弾く():
    try:
        nearby.search(ctx("userA", query={"lat": "999", "lon": "139.76"}))
        assert False, "例外が出るべき"
    except ApiError as e:
        assert e.code == "invalid_location", e.code


# ---------------- 好きな作品とおすすめ ----------------

def test_好きな作品を登録できる():
    res = body_of(me.update_me(ctx("userA", {"favorites": ["プロセカ", "天馬司"]})))
    names = [f["name"] for f in res["user"]["favorites"]]
    assert names == ["プロセカ", "天馬司"], names

    again = body_of(me.get_me(ctx("userA")))
    assert [f["name"] for f in again["user"]["favorites"]] == ["プロセカ", "天馬司"]


def test_好きな作品は20件まで():
    try:
        me.update_me(ctx("userA", {"favorites": [f"作品{i}" for i in range(21)]}))
        assert False, "例外が出るべき"
    except ApiError as e:
        assert e.code == "too_many_tags", e.code


def test_好みに近いカードがおすすめの上位に来る():
    make_card("userB", type="GIVE", title="関係ないカード", tags=["ウマ娘", "スペシャルウィーク"])
    make_card("userC", type="GIVE", title="好みのカード", tags=["プロセカ", "天馬司"])
    me.update_me(ctx("userA", {"favorites": ["プロセカ", "天馬司"]}))

    res = body_of(feed.list_(ctx("userA")))
    titles = [c["title"] for c in res["cards"]]
    assert titles[0] == "好みのカード", titles
    assert "プロセカ" in res["cards"][0]["reasonTags"], res["cards"][0]


def test_珍しいタグの一致が重く効く():
    # 「プロセカ」は多くのカードに付く一般的なタグにする
    for i in range(6):
        make_card(f"bulk{i}", type="GIVE", title=f"量産{i}", tags=["プロセカ", f"雑タグ{i}"])
    make_card("userC", type="GIVE", title="ニッチ一致", tags=["プロセカ", "天馬司"])
    me.update_me(ctx("userA", {"favorites": ["プロセカ", "天馬司"]}))

    res = body_of(feed.list_(ctx("userA")))
    assert res["cards"][0]["title"] == "ニッチ一致", [c["title"] for c in res["cards"]]


def test_共起タグで興味が広がる():
    # 「プロセカ」と「セカイ」が一緒に使われる実績を作る
    for i in range(3):
        make_card(f"seed{i}", type="GIVE", title=f"種{i}", tags=["プロセカ", "セカイ"])

    me.update_me(ctx("userA", {"favorites": ["プロセカ"]}))
    profile = recommend.expand_profile(
        recommend.build_profile("userA", db), db)
    assert tagutil.normalize("セカイ") in profile, profile


def test_好きな作品が無ければ新着順になる():
    make_card("userB", type="GIVE", title="古い", tags=["ウマ娘"])
    make_card("userC", type="GIVE", title="新しい", tags=["アイマス"])
    res = body_of(feed.list_(ctx("userA")))
    assert res["cards"][0]["title"] == "新しい", [c["title"] for c in res["cards"]]
    assert res["hasFavorites"] is False


# ---------------- スワイプ ----------------

def test_スワイプしたカードは二度出ない():
    made = make_card("userB", type="GIVE", title="対象", tags=["プロセカ"])
    card_id = made["card"]["cardId"]

    assert len(body_of(feed.list_(ctx("userA")))["cards"]) == 1
    feed.skip(ctx("userA"), card_id)
    assert body_of(feed.list_(ctx("userA")))["cards"] == []


def test_保存したカードは保存一覧に出る():
    made = make_card("userB", type="GIVE", title="保存する", tags=["プロセカ"])
    card_id = made["card"]["cardId"]
    feed.save(ctx("userA"), card_id)

    saved = body_of(feed.list_saved(ctx("userA")))["cards"]
    assert [c["title"] for c in saved] == ["保存する"], saved

    feed.unsave(ctx("userA"), card_id)
    assert body_of(feed.list_saved(ctx("userA")))["cards"] == []


def test_自分のカードはスワイプできない():
    made = make_card("userA", type="GIVE", title="自分の", tags=["プロセカ"])
    try:
        feed.save(ctx("userA"), made["card"]["cardId"])
        assert False, "例外が出るべき"
    except ApiError as e:
        assert e.code == "own_card", e.code


def test_自分のカードはフィードに出ない():
    make_card("userA", type="GIVE", title="自分の", tags=["プロセカ"])
    assert body_of(feed.list_(ctx("userA")))["cards"] == []


# ---------------- トークの画像・位置情報 ----------------

def test_位置情報だけのメッセージを送れる():
    match_id = _accepted_match()
    res = body_of(messages.create(
        ctx("userA", {"location": {"lat": 35.6812, "lon": 139.7671, "name": "東京駅"}}),
        match_id))
    assert res["message"]["kind"] == "location"
    assert res["message"]["location"]["name"] == "東京駅"


def test_他のトークの画像は貼れない():
    match_id = _accepted_match()
    try:
        messages.create(ctx("userA", {"imageKey": "chat/someone-else/abc.jpg"}), match_id)
        assert False, "例外が出るべき"
    except ApiError as e:
        assert e.code == "invalid_image", e.code


def test_画像メッセージは一覧で画像と表示される():
    match_id = _accepted_match()
    messages.create(ctx("userA", {"imageKey": f"chat/{match_id}/img.jpg"}), match_id)
    listed = body_of(matches.list_all(ctx("userB")))["matches"][0]
    assert listed["lastMessagePreview"] == "[画像]", listed


# ---------------- 相互交換が前提であること ----------------

def test_片方だけ欲しい状態ではマッチしない():
    """B は A の求めるものを持っているが、A は B の求めるものを持っていない。

    金銭のやり取りをしないので、これは交換として成立しない。
    """
    make_card("userA", type="WANT", title="Aが求む", tags=["プロセカ", "天馬司"], minMatchCount=1)
    result = make_card("userB", type="GIVE", title="Bが譲る",
                       tags=["プロセカ", "天馬司"], minMatchCount=1)

    assert result["newMatches"] == [], result["newMatches"]
    assert db.list_matches("userA") == []
    assert SENT == [], SENT


def test_お返しができるようになった時点でマッチする():
    make_card("userA", type="WANT", title="Aが求む", tags=["プロセカ", "天馬司"], minMatchCount=1)
    make_card("userB", type="GIVE", title="Bが譲る", tags=["プロセカ", "天馬司"], minMatchCount=1)
    assert db.list_matches("userA") == []

    # A が B の欲しいものを出した瞬間に成立する
    make_card("userB", type="WANT", title="Bが求む", tags=["プロセカ", "神代類"], minMatchCount=1)
    result = make_card("userA", type="GIVE", title="Aが譲る",
                       tags=["プロセカ", "神代類"], minMatchCount=1)

    assert len(result["newMatches"]) == 1, result["newMatches"]
    assert {s[0] for s in SENT} == {"userA", "userB"}, SENT


def test_渡すものと受け取るものが分かる():
    _mutual_pair()
    match_id = db.list_matches("userA")[0]["matchId"]
    view = body_of(matches.get_one(ctx("userA"), match_id))["match"]

    assert view["iGive"]["title"] == "userAが譲る", view["iGive"]
    assert view["iReceive"]["title"] == "userBが譲る", view["iReceive"]

    # B から見ると逆になる
    other = body_of(matches.get_one(ctx("userB"), match_id))["match"]
    assert other["iGive"]["title"] == "userBが譲る", other["iGive"]
    assert other["iReceive"]["title"] == "userAが譲る", other["iReceive"]


def test_同行は相互交換を求めない():
    # 同じイベントに行きたい者どうしは、モノのやり取りが無くても成立する
    make_card("userA", type="COMPANION", title="Aの同行募集",
              tags=["コミケ", "プロセカ"], dates=["2026-08-14"], minMatchCount=2)
    result = make_card("userB", type="COMPANION", title="Bの同行募集",
                       tags=["コミケ", "プロセカ"], dates=["2026-08-14"], minMatchCount=2)

    assert len(result["newMatches"]) == 1, result["newMatches"]
    assert {s[0] for s in SENT} == {"userA", "userB"}, SENT


def test_交換の相手ごとに1件だけマッチする():
    """同じ相手と複数のカードが噛み合っても、マッチは 1 件にまとめる。"""
    make_card("userA", type="GIVE", title="Aが譲る1", tags=["プロセカ", "天馬司"], minMatchCount=1)
    make_card("userA", type="GIVE", title="Aが譲る2", tags=["プロセカ", "天馬司"], minMatchCount=1)
    make_card("userA", type="WANT", title="Aが求む", tags=["プロセカ", "神代類"], minMatchCount=1)
    make_card("userB", type="GIVE", title="Bが譲る", tags=["プロセカ", "神代類"], minMatchCount=1)
    result = make_card("userB", type="WANT", title="Bが求む",
                       tags=["プロセカ", "天馬司"], minMatchCount=1)

    assert len(result["newMatches"]) == 1, result["newMatches"]
    assert len(db.list_matches("userA")) == 1


# ---------------- 環状交換（3人以上の輪） ----------------

def _three_way():
    """1対1では成立しないが、輪にすれば成立する 3 人を作る。

        A: 譲=五条 / 求=夏油
        B: 譲=夏油 / 求=伏黒
        C: 譲=伏黒 / 求=五条
    """
    make_card("A", type="GIVE", title="五条を譲る", tags=["呪術廻戦", "五条悟"], minMatchCount=2)
    make_card("A", type="WANT", title="夏油が欲しい", tags=["呪術廻戦", "夏油傑"], minMatchCount=2)
    make_card("B", type="GIVE", title="夏油を譲る", tags=["呪術廻戦", "夏油傑"], minMatchCount=2)
    make_card("B", type="WANT", title="伏黒が欲しい", tags=["呪術廻戦", "伏黒恵"], minMatchCount=2)
    make_card("C", type="WANT", title="五条が欲しい", tags=["呪術廻戦", "五条悟"], minMatchCount=2)
    SENT.clear()
    # 最後の 1 枚で輪が閉じる
    return make_card("C", type="GIVE", title="伏黒を譲る",
                     tags=["呪術廻戦", "伏黒恵"], minMatchCount=2)


def test_AとBは相互交換にならない():
    """A と B の間に「お互いに渡し合う」関係は作れないことを確かめる。

    B → A（夏油）の一方向は成立する。だが A が出せるのは五条で、
    B が欲しいのは伏黒なので A → B は成立しない。
    だから 2 人だけでは交換が完結せず、輪が要る。
    """
    import matching

    _three_way()
    a_give = [c for c in db.list_user_cards("A") if c["type"] == "GIVE"][0]
    receivers = {
        hit["card"]["ownerId"]
        for hit in matching.find_candidates(a_give) if hit["forPartner"]
    }
    assert "B" not in receivers, receivers   # A → B は無い
    assert "C" in receivers, receivers       # A → C なら成立する


def test_3人の輪が見つかる():
    result = _three_way()
    assert len(result["newGroups"]) >= 1, result["newGroups"]

    group = result["newGroups"][0]
    assert group["length"] == 3, group
    members = {m["userId"] for m in group["members"]}
    assert members == {"A", "B", "C"}, members


def test_輪は渡す順につながっている():
    _three_way()
    group = db.list_groups("A")[0]
    steps = group["steps"]

    # 各ステップの受け取り手が、次のステップの渡し手になっている
    for i, step in enumerate(steps):
        nxt = steps[(i + 1) % len(steps)]
        assert step["toUserId"] == nxt["fromUserId"], (step, nxt)

    # 全員がちょうど 1 回ずつ渡して受け取る
    assert sorted(s["fromUserId"] for s in steps) == ["A", "B", "C"]
    assert sorted(s["toUserId"] for s in steps) == ["A", "B", "C"]


def test_自分が渡す相手と受け取る相手が分かる():
    _three_way()
    group = db.list_groups("A")[0]
    detail = body_of(groups.get_one(ctx("A"), group["groupId"]))["group"]

    assert detail["iGive"]["title"] == "五条を譲る", detail["iGive"]
    assert detail["iReceive"]["title"] == "夏油を譲る", detail["iReceive"]
    assert detail["iGiveTo"]["userId"] == "C", detail["iGiveTo"]
    assert detail["iReceiveFrom"]["userId"] == "B", detail["iReceiveFrom"]


def test_参加者全員に提案が通知される():
    _three_way()
    notified = {s[0] for s in SENT}
    assert {"A", "B", "C"} <= notified, SENT


def test_全員が承諾して初めて成立する():
    _three_way()
    group_id = db.list_groups("A")[0]["groupId"]

    first = body_of(groups.accept(ctx("A"), group_id))
    assert first["established"] is False
    assert first["group"]["status"] == "NEW"

    body_of(groups.accept(ctx("B"), group_id))
    third = body_of(groups.accept(ctx("C"), group_id))
    assert third["established"] is True
    assert third["group"]["status"] == "ACCEPTED"


def test_1人でも見送ると解散する():
    _three_way()
    group_id = db.list_groups("A")[0]["groupId"]

    groups.accept(ctx("A"), group_id)
    res = body_of(groups.decline(ctx("B"), group_id))
    assert res["group"]["status"] == "DECLINED"

    # 解散後は承諾できない
    try:
        groups.accept(ctx("C"), group_id)
        assert False, "例外が出るべき"
    except ApiError as e:
        assert e.code == "declined", e.code


def test_成立前はグループトークできない():
    _three_way()
    group_id = db.list_groups("A")[0]["groupId"]
    try:
        groups.send_message(ctx("A", {"text": "よろしく"}), group_id)
        assert False, "例外が出るべき"
    except ApiError as e:
        assert e.code == "not_accepted", e.code


def test_成立後はグループトークできる():
    _three_way()
    group_id = db.list_groups("A")[0]["groupId"]
    for user in ("A", "B", "C"):
        groups.accept(ctx(user), group_id)

    groups.send_message(ctx("A", {"text": "明日どうしますか"}), group_id)
    listed = body_of(groups.list_messages(ctx("B"), group_id))
    assert [m["text"] for m in listed["messages"]] == ["明日どうしますか"]
    # 誰の発言か分かる
    assert listed["messages"][0]["sender"]["userId"] == "A"
    assert len(listed["members"]) == 3


def test_参加者以外はグループを見られない():
    _three_way()
    group_id = db.list_groups("A")[0]["groupId"]
    try:
        groups.get_one(ctx("stranger"), group_id)
        assert False, "例外が出るべき"
    except ApiError as e:
        assert e.code == "forbidden", e.code


def test_同じ輪は二度提案されない():
    _three_way()
    before = len(db.list_groups("A"))

    # もう一度同じ探索を回しても増えない
    card = [c for c in db.list_user_cards("C") if c["type"] == "GIVE"][0]
    for cycle in cycles.find_cycles(card):
        db.save_group(groups.build(cycle, "C"))
    assert len(db.list_groups("A")) == before


def test_輪が閉じない組み合わせでは提案されない():
    # C が求めるものを誰も持っていないので輪が閉じない
    make_card("A", type="GIVE", title="五条を譲る", tags=["呪術廻戦", "五条悟"], minMatchCount=2)
    make_card("A", type="WANT", title="夏油が欲しい", tags=["呪術廻戦", "夏油傑"], minMatchCount=2)
    make_card("B", type="GIVE", title="夏油を譲る", tags=["呪術廻戦", "夏油傑"], minMatchCount=2)
    result = make_card("B", type="WANT", title="虎杖が欲しい",
                       tags=["呪術廻戦", "虎杖悠仁"], minMatchCount=2)
    assert result["newGroups"] == [], result["newGroups"]


def test_2人で成立する場合は輪にしない():
    # A と B が相互に欲しいものを持っている＝通常のマッチで足りる
    make_card("A", type="GIVE", title="五条を譲る", tags=["呪術廻戦", "五条悟"], minMatchCount=2)
    make_card("A", type="WANT", title="夏油が欲しい", tags=["呪術廻戦", "夏油傑"], minMatchCount=2)
    make_card("B", type="WANT", title="五条が欲しい", tags=["呪術廻戦", "五条悟"], minMatchCount=2)
    result = make_card("B", type="GIVE", title="夏油を譲る",
                       tags=["呪術廻戦", "夏油傑"], minMatchCount=2)

    # 3 人以上の輪だけを提案する
    assert result["newGroups"] == [], result["newGroups"]
    # 通常のマッチは成立している
    assert len(db.list_matches("A")) >= 1


# ---------------- 距離を優先したマッチング ----------------

TOKYO = {"lat": 35.6812, "lon": 139.7671}      # 東京駅
SHINJUKU = {"lat": 35.6896, "lon": 139.7006}   # 新宿駅（東京駅から約6km）
OSAKA = {"lat": 34.7025, "lon": 135.4959}      # 大阪駅（約400km）


def test_条件が同じなら近い相手が先に来る():
    make_card("far", type="GIVE", title="大阪の人",
              tags=["プロセカ", "天馬司"], location=OSAKA, minMatchCount=1)
    make_card("near", type="GIVE", title="新宿の人",
              tags=["プロセカ", "天馬司"], location=SHINJUKU, minMatchCount=1)

    card = _built_card("me", type="WANT", title="求む",
                       tags=["プロセカ", "天馬司"], location=TOKYO, minMatchCount=1)
    hits = matching.find_candidates(card)
    assert [h["card"]["title"] for h in hits] == ["新宿の人", "大阪の人"], hits
    assert hits[0]["distanceKm"] < 10, hits[0]
    assert hits[0]["distanceLabel"].endswith("km")


def test_近ければタグ一致数が少なくても優先される():
    # タグは 3 件一致するが遠い
    make_card("far", type="GIVE", title="遠いが完全一致",
              tags=["プロセカ", "天馬司", "アクスタ"], location=OSAKA, minMatchCount=1)
    # タグは 1 件しか一致しないが近い
    make_card("near", type="GIVE", title="近いが1件一致",
              tags=["プロセカ", "神代類", "缶バッジ"], location=SHINJUKU, minMatchCount=1)

    card = _built_card("me", type="WANT", title="求む",
                       tags=["プロセカ", "天馬司", "アクスタ"], location=TOKYO, minMatchCount=1)
    hits = matching.find_candidates(card)
    assert hits[0]["card"]["title"] == "近いが1件一致", [h["card"]["title"] for h in hits]


def test_遠すぎる相手同士はタグ一致数で並ぶ():
    # どちらも 50km より遠いので、距離ではなくタグ数で決まる
    far_a = {"lat": 34.7025, "lon": 135.4959}    # 大阪
    far_b = {"lat": 43.0687, "lon": 141.3508}    # 札幌
    make_card("osaka", type="GIVE", title="大阪1件",
              tags=["プロセカ", "神代類"], location=far_a, minMatchCount=1)
    make_card("sapporo", type="GIVE", title="札幌2件",
              tags=["プロセカ", "天馬司"], location=far_b, minMatchCount=1)

    card = _built_card("me", type="WANT", title="求む",
                       tags=["プロセカ", "天馬司"], location=TOKYO, minMatchCount=1)
    hits = matching.find_candidates(card)
    assert hits[0]["card"]["title"] == "札幌2件", [h["card"]["title"] for h in hits]


def test_位置がない相手は距離が分かる相手の後ろに来る():
    make_card("nowhere", type="GIVE", title="位置なし完全一致",
              tags=["プロセカ", "天馬司", "アクスタ"], minMatchCount=1)
    make_card("near", type="GIVE", title="近いが1件一致",
              tags=["プロセカ", "神代類"], location=SHINJUKU, minMatchCount=1)

    card = _built_card("me", type="WANT", title="求む",
                       tags=["プロセカ", "天馬司", "アクスタ"], location=TOKYO, minMatchCount=1)
    hits = matching.find_candidates(card)
    assert hits[0]["card"]["title"] == "近いが1件一致", [h["card"]["title"] for h in hits]
    assert hits[1].get("distanceKm") is None


def test_拠点を登録すればカードに位置がなくても距離が出る():
    # 相手はカードに位置を付けず、プロフィールの拠点だけ持つ
    make_card("near", type="GIVE", title="拠点だけの人",
              tags=["プロセカ", "天馬司"], minMatchCount=1)
    me.update_me(ctx("near", {"homeLocation": SHINJUKU}))

    card = _built_card("me", type="WANT", title="求む",
                       tags=["プロセカ", "天馬司"], location=TOKYO, minMatchCount=1)
    hits = matching.find_candidates(card)
    assert hits[0].get("distanceKm") is not None, hits[0]
    assert hits[0]["distanceKm"] < 10, hits[0]


def test_自分の拠点も距離の基準になる():
    make_card("near", type="GIVE", title="新宿の人",
              tags=["プロセカ", "天馬司"], location=SHINJUKU, minMatchCount=1)

    # 自分のカードには位置を付けず、拠点だけ設定する
    me.update_me(ctx("me", {"homeLocation": TOKYO}))
    card = _built_card("me", type="WANT", title="求む",
                       tags=["プロセカ", "天馬司"], minMatchCount=1)
    hits = matching.find_candidates(card)
    assert hits[0].get("distanceKm") is not None, hits[0]


def test_拠点は外せる():
    me.update_me(ctx("me", {"homeLocation": TOKYO}))
    assert db.get_user("me").get("homeLocation") is not None

    res = body_of(me.update_me(ctx("me", {"homeLocation": None})))
    assert res["user"]["homeLocation"] is None, res
    assert db.get_user("me").get("homeLocation") is None


def test_マッチに距離が保存される():
    make_card("near", type="GIVE", title="新宿の人",
              tags=["プロセカ", "天馬司"], location=SHINJUKU, minMatchCount=1)
    make_card("near", type="WANT", title="新宿の人が求む",
              tags=["プロセカ", "神代類"], location=SHINJUKU, minMatchCount=1)
    make_card("me", type="GIVE", title="私が譲る",
              tags=["プロセカ", "神代類"], location=TOKYO, minMatchCount=1)
    make_card("me", type="WANT", title="求む",
              tags=["プロセカ", "天馬司"], location=TOKYO, minMatchCount=1)

    match = db.list_matches("me")[0]
    assert match.get("distanceLabel"), match
    view = body_of(matches.list_all(ctx("me")))["matches"][0]
    assert view["distanceLabel"], view


# ---------------- 通知カード ----------------

def _cards_for(user_id):
    """そのユーザーに送られた Flex カードだけ取り出す。"""
    out = []
    for uid, messages in PUSHED:
        if uid != user_id:
            continue
        out.extend(m for m in messages if m.get("type") == "flex")
    return out


def _card_texts(card):
    """Flex の中の文字列を全部集める（文言の検証用）。"""
    found = []

    def walk(node):
        if isinstance(node, dict):
            if node.get("type") == "text" and isinstance(node.get("text"), str):
                found.append(node["text"])
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(card)
    return found


def test_話したいの通知がカード形式で届く():
    match_id = _new_match()
    PUSHED.clear()
    matches.accept(ctx("userA", name="太郎"), match_id)

    cards_sent = _cards_for("userB")
    assert len(cards_sent) == 1, PUSHED
    card = cards_sent[0]
    assert card["type"] == "flex"
    assert "話したい" in card["altText"], card["altText"]
    # ボタンからマッチ詳細へ飛べる
    footer = card["contents"]["footer"]["contents"][0]
    assert footer["action"]["type"] == "uri"
    assert f"/matches/{match_id}" in footer["action"]["uri"]


def test_双方承諾の通知がカードで両方に届く():
    match_id = _new_match()
    matches.accept(ctx("userA"), match_id)
    PUSHED.clear()
    matches.accept(ctx("userB"), match_id)

    for user in ("userA", "userB"):
        cards_sent = _cards_for(user)
        assert len(cards_sent) == 1, (user, PUSHED)
        assert "/chat" in cards_sent[0]["contents"]["footer"]["contents"][0]["action"]["uri"]


def test_チャットの通知がカード形式で本文つきで届く():
    match_id = _accepted_match()
    PUSHED.clear()
    messages.create(ctx("userA", {"text": "はじめまして、よろしくお願いします"}), match_id)

    cards_sent = _cards_for("userB")
    assert len(cards_sent) == 1, PUSHED
    texts = _card_texts(cards_sent[0])
    assert any("はじめまして" in t for t in texts), texts
    assert any("メッセージ" in t for t in texts), texts


def test_画像の通知は本文なしでカードになる():
    match_id = _accepted_match()
    PUSHED.clear()
    messages.create(ctx("userA", {"imageKey": f"chat/{match_id}/x.jpg"}), match_id)

    texts = _card_texts(_cards_for("userB")[0])
    assert any("画像を送りました" in t for t in texts), texts


def test_位置情報は地図バブルとカードの2通で届く():
    match_id = _accepted_match()
    PUSHED.clear()
    messages.create(
        ctx("userA", {"location": {"lat": 35.6812, "lon": 139.7671, "name": "東京駅"}}),
        match_id)

    sent = [m for uid, ms in PUSHED if uid == "userB" for m in ms]
    kinds = [m["type"] for m in sent]
    assert "location" in kinds, kinds   # LINE の地図バブル
    assert "flex" in kinds, kinds       # 返信への導線


def test_取引完了の通知がカードで届く():
    match_id = _accepted_match()
    PUSHED.clear()
    matches.complete(ctx("userA"), match_id)

    texts = _card_texts(_cards_for("userB")[0])
    assert any("評価" in t for t in texts), texts


def test_グループ成立の通知がカードで届く():
    _three_way()
    group_id = db.list_groups("A")[0]["groupId"]
    groups.accept(ctx("A"), group_id)
    groups.accept(ctx("B"), group_id)
    PUSHED.clear()
    groups.accept(ctx("C"), group_id)

    for user in ("A", "B", "C"):
        cards_sent = _cards_for(user)
        assert len(cards_sent) >= 1, (user, PUSHED)
        assert "/groups/" in cards_sent[0]["contents"]["footer"]["contents"][0]["action"]["uri"]


# ---------------- 画像アップロード ----------------

def test_アップロード用の署名URLをもらえる():
    match_id = _accepted_match()
    res = body_of(uploads.create(ctx("userA", {
        "matchId": match_id, "contentType": "image/jpeg", "size": 1024,
    })))
    assert res["uploadUrl"].startswith("https://"), res
    assert res["imageKey"].startswith(f"chat/{match_id}/"), res
    assert res["imageKey"].endswith(".jpg"), res


def test_署名にContentTypeを含めない():
    """含めるとブラウザが送るヘッダと 1 文字でも違えば署名エラーになるため。"""
    match_id = _accepted_match()
    uploads.create(ctx("userA", {
        "matchId": match_id, "contentType": "image/png", "size": 100,
    }))
    operation, key = fake_aws._RESOURCE.s3.puts[-1]
    assert operation == "put_object", operation
    assert key.endswith(".png"), key


def test_対応していない形式は弾く():
    match_id = _accepted_match()
    try:
        uploads.create(ctx("userA", {
            "matchId": match_id, "contentType": "image/gif", "size": 100,
        }))
        assert False, "例外が出るべき"
    except ApiError as e:
        assert e.code == "unsupported_type", e.code


def test_大きすぎる画像は弾く():
    match_id = _accepted_match()
    try:
        uploads.create(ctx("userA", {
            "matchId": match_id, "contentType": "image/jpeg", "size": 6 * 1024 * 1024,
        }))
        assert False, "例外が出るべき"
    except ApiError as e:
        assert e.code == "too_large", e.code


def test_当事者以外はアップロードできない():
    match_id = _accepted_match()
    try:
        uploads.create(ctx("stranger", {
            "matchId": match_id, "contentType": "image/jpeg", "size": 100,
        }))
        assert False, "例外が出るべき"
    except ApiError as e:
        assert e.code == "forbidden", e.code


def test_グループトークにも画像を上げられる():
    _three_way()
    group_id = db.list_groups("A")[0]["groupId"]
    res = body_of(uploads.create(ctx("A", {
        "groupId": group_id, "contentType": "image/jpeg", "size": 100,
    })))
    assert res["imageKey"].startswith(f"chat/{group_id}/"), res


def test_閲覧URLは拡張子から正しい型を返す():
    url = uploads.presign_get("chat/abc/def.png")
    assert url and "get_object" in url, url


if __name__ == "__main__":
    print("タグ一致マッチング テスト\n")
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            test(fn)

    print(f"\n合計 {len(PASSED) + len(FAILED)} 件 / 成功 {len(PASSED)} / 失敗 {len(FAILED)}")
    if FAILED:
        for name, reason in FAILED:
            print(f"  - {name}: {reason}")
        sys.exit(1)
