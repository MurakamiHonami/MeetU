import { useEffect, useState } from "react";
import { useNavigate } from "../../shared/lib/navigation";
import CardItem from "../CardItem";
import RespondToCardButton from "../RespondToCardButton";
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
          相手の条件に合う【譲/求/同行者求】カードを持っていれば、その場で応募してマッチできます。
          持っていない場合はカード登録画面へ進みます。
        </p>
        <div className="actions">
          <RespondToCardButton card={card} />
          <button onClick={() => navigate(-1)}>戻る</button>
        </div>
      </section>
    </div>
  );
}
