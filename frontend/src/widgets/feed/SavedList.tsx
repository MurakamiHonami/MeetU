import { useEffect, useState } from "react";
import { useNavigate } from "../../shared/lib/navigation";
import CardItem from "../CardItem";
import { feedApi } from "../../features/feed/api";
import type { Card } from "../../entities/card/model";

export function SavedList() {
  const navigate = useNavigate();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    feedApi
      .savedCards()
      .then((res) => setCards(res.cards))
      .catch((e) => setError(e.message));
  }, []);

  async function remove(cardId: string) {
    try {
      await feedApi.unsaveCard(cardId);
      setCards((prev) => (prev ?? []).filter((c) => c.cardId !== cardId));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!cards) return <p className="loading">読み込み中…</p>;

  return (
    <div className="page">
      <h2>保存したカード</h2>

      {cards.length === 0 && (
        <p className="hint">まだありません。ホームの新着を右にスワイプすると保存できます。</p>
      )}

      {cards.map((card) => (
        <CardItem
          key={card.cardId}
          card={card}
          onClick={() => navigate(`/cards/${card.cardId}`)}
          footer={
            <div className="card-actions">
              <button
                onClick={(e) => {
                  e.stopPropagation(); // カード全体のタップと二重に反応させない
                  void remove(card.cardId);
                }}
              >
                保存を解除
              </button>
            </div>
          }
        />
      ))}
    </div>
  );
}
