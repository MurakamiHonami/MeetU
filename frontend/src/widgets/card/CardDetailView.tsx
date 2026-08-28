import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CardItem from "../CardItem";
import { cardApi } from "../../features/card/api";
import type { Card } from "../../entities/card/model";

type Props = { cardId: string };

export function CardDetailView({ cardId }: Props) {
  const navigate = useNavigate();
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    cardApi
      .card(cardId)
      .then((res) => setCard(res.card))
      .catch((e) => setError(e.message));
  }, [cardId]);

  if (error) return <p className="error">{error}</p>;
  if (!card) return <p className="loading">読み込み中…</p>;

  return (
    <div className="page">
      <h2>カードの詳細</h2>
      <CardItem card={card} />

      <section className="panel panel-quiet">
        <p className="hint">
          やり取りはマッチが成立してから始まります。条件の合うカードを自分で登録しておくと、
          相手と自動でマッチして通知が届きます。
        </p>
        <div className="actions">
          <button className="primary" onClick={() => navigate("/cards/new")}>
            自分のカードを登録する
          </button>
          <button onClick={() => navigate(-1)}>戻る</button>
        </div>
      </section>
    </div>
  );
}
