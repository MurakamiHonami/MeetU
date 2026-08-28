import { useRef } from "react";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";

type Props = {
  text: string;
  sending: boolean;
  busyLabel: string;
  lockedMessage: string;
  canSend: boolean;
  onTextChange: (value: string) => void;
  onSendText: () => void;
  onSendImage: (file: File) => void;
  onSendLocation: () => void;
};

export function ChatComposer({
  text,
  sending,
  busyLabel,
  lockedMessage,
  canSend,
  onTextChange,
  onSendText,
  onSendImage,
  onSendLocation,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);

  if (!canSend) {
    return <p className="hint chat-locked">{lockedMessage}</p>;
  }

  return (
    <>
      {busyLabel && <p className="notice chat-error">{busyLabel}</p>}
      <div className="chat-input">
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onSendImage(file);
            if (fileInput.current) fileInput.current.value = "";
          }}
        />
        <button
          type="button"
          className="chat-tool"
          disabled={sending}
          title="画像を送る"
          onClick={() => fileInput.current?.click()}
        >
          <ImageRoundedIcon />
        </button>
        <button
          type="button"
          className="chat-tool teal"
          disabled={sending}
          title="現在地を送る"
          onClick={onSendLocation}
        >
          <PlaceRoundedIcon />
        </button>

        <textarea
          className="input"
          rows={1}
          value={text}
          maxLength={1000}
          placeholder="メッセージを入力"
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSendText();
            }
          }}
        />
        <button
          type="button"
          className="primary chat-send"
          disabled={sending || !text.trim()}
          onClick={onSendText}
        >
          <SendRoundedIcon />
        </button>
      </div>
    </>
  );
}
