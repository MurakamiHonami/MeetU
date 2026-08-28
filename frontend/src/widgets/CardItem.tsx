import type { ReactNode } from "react";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import { TYPE_LABEL, type Card } from "../entities/card/model";

type Props = {
  card: Card;
  onClick?: () => void;
  footer?: ReactNode;
};

/** カード 1 件の表示。一致したタグは色を変えて先に見せる。 */
export default function CardItem({ card, onClick, footer }: Props) {
  const matched = new Set(card.matchedTags ?? []);
  const required = new Set(card.requiredTags ?? []);

  const details: string[] = [];
  if (card.dates?.length) details.push(card.dates.join(" / "));

  return (
    <article className={`card ${onClick ? "card-clickable" : ""}`} onClick={onClick}>
      <div className="card-head">
        <span className={`badge badge-${card.type}`}>{TYPE_LABEL[card.type]}</span>
        <h3>{card.title}</h3>
      </div>

      {card.matchCount != null && (
        <p className="matchline">
          タグ <strong>{card.matchCount}件</strong> 一致
        </p>
      )}

      <div className="chips chips-sm">
        {card.tags.map((tag) => (
          <span
            key={tag.tagId}
            className={`chip ${matched.has(tag.name) ? "chip-matched" : ""} ${
              required.has(tag.tagId) ? "chip-required" : ""
            }`}
          >
            {required.has(tag.tagId) && "★"}
            {tag.name}
          </span>
        ))}
      </div>

      {details.length > 0 && <p className="card-detail">{details.join(" ・ ")}</p>}
      {card.location && (
        <p className="card-detail">
          <PlaceRoundedIcon fontSize="inherit" /> {card.location.name ?? "位置情報あり"}
          {card.distanceLabel && <span className="distance">{card.distanceLabel}</span>}
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

      {card.status === "CLOSED" && <p className="card-closed">このカードは終了しています</p>}
      {footer}
    </article>
  );
}
