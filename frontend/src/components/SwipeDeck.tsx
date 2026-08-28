import { useEffect, useRef, useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import { TYPE_LABEL, type Card } from "../lib/api";

type Props = {
  cards: Card[];
  onSave: (card: Card) => void;
  onSkip: (card: Card) => void;
  onOpen: (card: Card) => void;
};

const SWIPE_THRESHOLD = 90;   // これ以上動かしたら確定

/**
 * 新着カードを 1 枚ずつ見せて、右に振ると保存・左に振ると見送り。
 * ポインタイベントで実装しているので、タッチでもマウスでも動く。
 */
export default function SwipeDeck({ cards, onSave, onSkip, onOpen }: Props) {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [leaving, setLeaving] = useState<"save" | "skip" | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  // カードが差し替わったら先頭に戻す
  useEffect(() => {
    setIndex(0);
    setDrag({ x: 0, y: 0 });
    setLeaving(null);
  }, [cards]);

  const card = cards[index];
  const next = cards[index + 1];

  function finish(action: "save" | "skip") {
    if (!card || leaving) return;
    setLeaving(action);
    // 飛んでいくアニメーションを見せてから次へ
    window.setTimeout(() => {
      (action === "save" ? onSave : onSkip)(card);
      setIndex((i) => i + 1);
      setDrag({ x: 0, y: 0 });
      setLeaving(null);
    }, 220);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (leaving) return;
    start.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!start.current || leaving) return;
    setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y });
  }

  function onPointerUp() {
    if (!start.current || leaving) return;
    const moved = drag.x;
    start.current = null;

    if (moved > SWIPE_THRESHOLD) finish("save");
    else if (moved < -SWIPE_THRESHOLD) finish("skip");
    else setDrag({ x: 0, y: 0 });   // 戻す
  }

  if (!card) {
    return (
      <div className="deck-empty">
        <p className="hint">
          いま表示できる新着カードはありません。
          <br />
          他のユーザーのカードが増えると、ここでスワイプできます。
          <br />
          保存したカードは「保存したカード」から確認できます。
        </p>
      </div>
    );
  }

  const offset = leaving === "save" ? 500 : leaving === "skip" ? -500 : drag.x;
  const tilt = offset / 18;
  const intent = offset > 40 ? "save" : offset < -40 ? "skip" : null;

  return (
    <div className="deck">
      {next && (
        <article className="deck-card deck-behind">
          <div className="card-head">
            <span className={`badge badge-${next.type}`}>{TYPE_LABEL[next.type]}</span>
            <h3>{next.title}</h3>
          </div>
        </article>
      )}

      <article
        className={`deck-card ${leaving ? "deck-leaving" : ""}`}
        style={{
          transform: `translate(${offset}px, ${leaving ? -40 : drag.y * 0.2}px) rotate(${tilt}deg)`,
          transition: leaving || offset === 0 ? "transform 0.22s ease" : "none",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {intent && (
          <span className={`deck-stamp stamp-${intent}`}>
            {intent === "save" ? "保存" : "スキップ"}
          </span>
        )}

        <div className="card-head">
          <span className={`badge badge-${card.type}`}>{TYPE_LABEL[card.type]}</span>
          <h3>{card.title}</h3>
        </div>

        {card.reasonTags && card.reasonTags.length > 0 && (
          <p className="matchline">
            好みに合う: <strong>{card.reasonTags.join(" / ")}</strong>
          </p>
        )}

        <div className="chips chips-sm">
          {card.tags.map((tag) => (
            <span key={tag.tagId} className="chip">
              {tag.name}
            </span>
          ))}
        </div>

        {card.dates && <p className="card-detail">{card.dates.join(" / ")}</p>}
        {card.location && (
          <p className="card-detail">
            <PlaceRoundedIcon fontSize="inherit" /> {card.location.name ?? "位置情報あり"}
          </p>
        )}
        {card.note && <p className="card-note">{card.note}</p>}

        {card.owner && (
          <p className="card-owner">
            {card.owner.displayName}
            {card.owner.isNew ? (
              <span className="tagline tagline-new">新規</span>
            ) : (
              <span className="tagline">
                ★{card.owner.ratingAvg}（{card.owner.ratingCount}件）
              </span>
            )}
          </p>
        )}

        <button className="link deck-detail" onClick={() => onOpen(card)}>
          詳細を見る
        </button>
      </article>

      <div className="deck-actions">
        <button className="deck-skip" onClick={() => finish("skip")} title="スキップ">
          <CloseRoundedIcon />
        </button>
        <span className="deck-count">
          残り {cards.length - index} 件
        </span>
        <button className="deck-save" onClick={() => finish("save")} title="保存">
          <FavoriteRoundedIcon />
        </button>
      </div>
    </div>
  );
}
