import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CardItem from "../components/CardItem";
import TagInput, { type PickedTag } from "../components/TagInput";
import { api, TYPE_LABEL, type Card, type CardType } from "../lib/api";

export default function Search() {
  const navigate = useNavigate();
  const [tags, setTags] = useState<PickedTag[]>([]);
  const [type, setType] = useState<CardType | "">("");
  const [minMatch, setMinMatch] = useState(1);
  const [cards, setCards] = useState<Card[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const upper = Math.max(tags.length, 1);
  const threshold = Math.min(minMatch, upper);

  async function run() {
    setError("");
    if (tags.length === 0) return setError("タグを 1 つ以上追加してください");

    setLoading(true);
    try {
      const res = await api.search({
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
      <h2>募集を探す</h2>

      <div className="field">
        <span>探したい条件のタグ</span>
        <TagInput value={tags} onChange={setTags} required={[]} onRequiredChange={() => {}} />
      </div>

      <label className="field">
        <span>種類</span>
        <div className="typeswitch">
          <button type="button" className={type === "" ? "active" : ""} onClick={() => setType("")}>
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
    </div>
  );
}
