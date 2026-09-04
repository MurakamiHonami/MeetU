import { useEffect, useState } from "react";
import { useNavigate } from "../../shared/lib/navigation";
import CardItem from "../CardItem";
import { cardApi } from "../../features/card/api";
import type { Card } from "../../entities/card/model";

export function MyCardsList() {
  const navigate = useNavigate();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Record<string, Card[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    cardApi
      .myCards()
      .then((res) => setCards(res.cards))
      .catch((e) => setError(e.message));
  }, []);

  async function toggle(card: Card) {
    if (openId === card.cardId) {
      setOpenId(null);
      return;
    }
    setOpenId(card.cardId);
    if (candidates[card.cardId]) return;

    setLoadingId(card.cardId);
    try {
      const res = await cardApi.cardMatches(card.cardId);
      setCandidates((prev) => ({ ...prev, [card.cardId]: res.cards }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingId(null);
    }
  }

  async function close(card: Card) {
    if (!window.confirm(`「${card.title}」を終了しますか？（マッチ対象から外れます）`)) return;
    try {
      await cardApi.closeCard(card.cardId);
      setCards((prev) =>
        (prev ?? []).map((c) => (c.cardId === card.cardId ? { ...c, status: "CLOSED" } : c)),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!cards) return <p className="loading">読み込み中…</p>;

  return (
    <div className="page">
      <h2>自分のカード</h2>

      {cards.length === 0 && (
        <p className="hint">まだカードがありません。ホームから登録してください。</p>
      )}

      {cards.map((card) => (
        <div key={card.cardId}>
          <CardItem
            card={card}
            footer={
              <div className="card-actions">
                <span className="hint">{card.minMatchCount}件以上一致で通知</span>
                {card.status === "OPEN" && (
                  <>
                    <button type="button" onClick={() => toggle(card)}>
                      {openId === card.cardId ? "閉じる" : "一致する相手を見る"}
                    </button>
                    <button type="button" onClick={() => close(card)}>
                      終了する
                    </button>
                  </>
                )}
              </div>
            }
          />

          {openId === card.cardId && (
            <div className="nested">
              {loadingId === card.cardId && <p className="loading">検索中…</p>}
              {candidates[card.cardId]?.length === 0 && (
                <p className="hint">
                  いまは一致する相手がいません。条件に合うカードが出たら通知します。
                </p>
              )}
              {candidates[card.cardId]?.map((other) => (
                <CardItem
                  key={other.cardId}
                  card={other}
                  onClick={() => navigate(`/cards/${other.cardId}`)}
                />
              ))}
              {(candidates[card.cardId]?.length ?? 0) > 0 && (
                <p className="hint">近い相手から順に並んでいます。</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
