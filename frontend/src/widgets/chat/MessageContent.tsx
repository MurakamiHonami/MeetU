import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import type { Message } from "../../entities/message/model";
import { mapLink } from "../../shared/lib/device";

type Props = {
  message: Message;
};

export function MessageContent({ message: m }: Props) {
  if (m.kind === "image" && m.imageUrl) {
    return (
      <a href={m.imageUrl} target="_blank" rel="noreferrer" className="bubble-image">
        <img src={m.imageUrl} alt="送信された画像" loading="lazy" />
      </a>
    );
  }
  if (m.kind === "location" && m.location) {
    return (
      <a href={mapLink(m.location)} target="_blank" rel="noreferrer" className="bubble-location">
        <PlaceRoundedIcon fontSize="small" />
        <span>
          <strong>{m.location.name ?? "現在地"}</strong>
          <em>地図で開く</em>
        </span>
      </a>
    );
  }
  return <>{m.text}</>;
}

export function formatMessageTime(iso: string) {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}
