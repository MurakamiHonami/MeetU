import { useState } from "react";
import HandshakeRoundedIcon from "@mui/icons-material/HandshakeRounded";
import { useNavigate } from "react-router-dom";
import CardItem from "./CardItem";
import { cardApi, type RespondOption } from "../features/card/api";
import type { Card } from "../entities/card/model";

type Props = {
  card: Card;
  className?: string;
  onResponded?: () => void;
};

/** 他人のカード条件に、自分の対応カードで応募してマッチを作る */
export default function RespondToCardButton({ card, className = "primary", onResponded }: Props) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);
  const [options, setOptions] = useState<RespondOption[]>([]);

  async function respond(myCardId: string) {
    setBusy(true);
    setError("");
    try {
      const res = await cardApi.respond(card.cardId, myCardId);
      onResponded?.();
      navigate(`/matches/${res.match.matchId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setPicking(false);
    }
  }

  async function start() {
    setBusy(true);
    setError("");
    try {
      const res = await cardApi.respondOptions(card.cardId);
      if (res.options.length === 0) {
        navigate(`/cards/new?respondTo=${card.cardId}`);
        return;
      }
      if (res.options.length === 1) {
        await respond(res.options[0].card.cardId);
        return;
      }
      setOptions(res.options);
      setPicking(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className={className} disabled={busy} onClick={start} type="button">
        <HandshakeRoundedIcon fontSize="small" /> {busy ? "確認中…" : "この条件で応募する"}
      </button>
      {error && <p className="error">{error}</p>}

      {picking && (
        <div className="modal-backdrop" onClick={() => !busy && setPicking(false)}>
          <div className="modal panel" onClick={(e) => e.stopPropagation()}>
            <h3>どのカードで応募しますか？</h3>
            <p className="hint">条件が一致する自分のカードを選んでください。</p>
            {options.map((opt) => (
              <article
                key={opt.card.cardId}
                className="card card-clickable"
                onClick={() => !busy && respond(opt.card.cardId)}
              >
                <CardItem
                  card={{
                    ...opt.card,
                    matchedTags: opt.matchedTags,
                    matchCount: opt.matchCount,
                  }}
                />
              </article>
            ))}
            <div className="actions">
              <button type="button" onClick={() => navigate(`/cards/new?respondTo=${card.cardId}`)}>
                新しいカードを作る
              </button>
              <button type="button" disabled={busy} onClick={() => setPicking(false)}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
