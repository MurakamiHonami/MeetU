import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "../../shared/lib/navigation";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import CardItem from "../CardItem";
import SwipeDeck from "../SwipeDeck";
import TagInput, { type PickedTag } from "../TagInput";
import { cardApi } from "../../features/card/api";
import { feedApi } from "../../features/feed/api";
import { TYPE_LABEL, type Card, type CardType } from "../../entities/card/model";

export function SearchView() {
  const navigate = useNavigate();
  const [tags, setTags] = useState<PickedTag[]>([]);
  const [type, setType] = useState<CardType | "">("");
  const [minMatch, setMinMatch] = useState(1);
  const [cards, setCards] = useState<Card[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [feed, setFeed] = useState<Card[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const formRef = useRef<HTMLElement>(null);

  const upper = Math.max(tags.length, 1);
  const threshold = Math.min(minMatch, upper);

  useEffect(() => {
    let alive = true;
    feedApi
      .feed()
      .then((res) => {
        if (alive) setFeed(res.cards);
      })
      .catch((e) => {
        if (alive) setError((e as Error).message);
      })
      .finally(() => {
        if (alive) setLoadingFeed(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  /** 「お取引開始」のカードから、種類を決め打ちして検索フォームへ送る */
  const startSearch = useCallback((next: CardType | "") => {
    setType(next);
    setCards(null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  function swipe(card: Card, action: "save" | "skip") {
    const call = action === "save" ? feedApi.saveCard : feedApi.skipCard;
    setFeed((prev) => prev.filter((c) => c.cardId !== card.cardId));
    call(card.cardId).catch((e) => setError((e as Error).message));
  }

  async function run() {
    setError("");
    if (tags.length === 0) return setError("タグを 1 つ以上追加してください");

    setLoading(true);
    try {
      const res = await cardApi.search({
        tags: tags.map((t) => t.name),
        type,
        minMatch: threshold,
      });
      setCards(res.cards);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <section className="start">
        <h2>お取引開始</h2>
        <div className="menu">
          <button className="menu-item" onClick={() => startSearch("")}>
            <span className="menu-icon icon-teal">
              <SwapHorizRoundedIcon />
            </span>
            <span className="menu-text">
              <strong>交換相手を探す</strong>
              <span>タグを指定して、譲れる人・欲しい人のカードを探す</span>
            </span>
          </button>

          <button className="menu-item" onClick={() => startSearch("COMPANION")}>
            <span className="menu-icon icon-gold">
              <GroupsRoundedIcon />
            </span>
            <span className="menu-text">
              <strong>同行者を探す</strong>
              <span>イベントやライブに一緒に行く相手のカードを探す</span>
            </span>
          </button>
        </div>
      </section>

      <section className="home-feed">
        <h2>新着をチェック</h2>
        <p className="hint deck-help">
          右にスワイプで保存、左でスキップ。好きな作品を登録しておくと、好みに近い順に並びます。
        </p>

        {loadingFeed ? (
          <p className="loading">新着を読み込み中…</p>
        ) : (
          <SwipeDeck
            key={feed.map((c) => c.cardId).join("|") || "empty"}
            cards={feed}
            onSave={(c) => swipe(c, "save")}
            onSkip={(c) => swipe(c, "skip")}
            onOpen={(c) => navigate(`/cards/${c.cardId}`)}
          />
        )}
      </section>

      <section ref={formRef}>
        <h2>条件で探す</h2>

        <div className="field">
          <span>探したい条件のタグ</span>
          <TagInput value={tags} onChange={setTags} required={[]} onRequiredChange={() => {}} />
        </div>

        <label className="field">
          <span>種類</span>
          <div className="typeswitch">
            <button
              type="button"
              className={type === "" ? "active" : ""}
              onClick={() => setType("")}
            >
              すべて
            </button>
            {(Object.keys(TYPE_LABEL) as CardType[]).map((t) => (
              <button
                key={t}
                type="button"
                className={type === t ? "active" : ""}
                onClick={() => setType(t)}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </label>

        <label className="field">
          <span>
            <strong>{threshold}件以上</strong> 一致するカードを表示
          </span>
          <input
            type="range"
            min={1}
            max={upper}
            value={threshold}
            disabled={upper === 1}
            onChange={(e) => setMinMatch(Number(e.target.value))}
          />
        </label>

        {error && <p className="error">{error}</p>}

        <div className="actions">
          <button className="primary" disabled={loading} onClick={run}>
            {loading ? "検索中…" : "検索する"}
          </button>
        </div>

        {cards && (
          <section className="results">
            <h3>{cards.length}件見つかりました</h3>
            {cards.length === 0 && (
              <p className="hint">
                条件を満たすカードがありません。一致件数を下げるか、タグを減らしてみてください。
              </p>
            )}
            {cards.map((card) => (
              <CardItem
                key={card.cardId}
                card={card}
                onClick={() => navigate(`/cards/${card.cardId}`)}
              />
            ))}
          </section>
        )}
      </section>
    </div>
  );
}
