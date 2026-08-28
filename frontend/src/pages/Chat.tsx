import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import { api } from "../features/api";
import type { Message } from "../entities/message/model";
import type { Owner } from "../entities/user/model";
import { currentPosition, mapLink, shrinkImage } from "../shared/lib/device";

const POLL_MS = 4000;

function timeOf(iso: string) {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function Chat() {
  const { matchId = "" } = useParams();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([]);
  const [partner, setPartner] = useState<Owner | null>(null);
  const [canSend, setCanSend] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [error, setError] = useState("");

  const bottom = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const lastId = useRef<string | undefined>(undefined);

  const scrollToBottom = useCallback(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, []);

  // 初回は全件、以降は after で差分だけ取りに行く
  const load = useCallback(async (initial: boolean) => {
    try {
      const res = await api.messages(matchId, initial ? undefined : lastId.current);
      if (initial) {
        setMessages(res.messages);
        setPartner(res.partner);
        setCanSend(res.canSend);
      } else if (res.messages.length > 0) {
        setMessages((prev) => [...prev, ...res.messages]);
      }
      if (res.messages.length > 0) {
        lastId.current = res.messages[res.messages.length - 1].messageId;
      }
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (initial) setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    void load(true);
  }, [load]);

  // 開いている間だけポーリングする
  useEffect(() => {
    const timer = window.setInterval(() => void load(false), POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(scrollToBottom, [messages, scrollToBottom]);

  function append(message: Message) {
    setMessages((prev) => [...prev, message]);
    lastId.current = message.messageId;
  }

  async function sendText() {
    const body = text.trim();
    if (!body || sending) return;

    setSending(true);
    setError("");
    try {
      const res = await api.sendMessage(matchId, { text: body });
      append(res.message);
      setText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function sendImage(file: File) {
    setSending(true);
    setBusyLabel("画像を送信中…");
    setError("");
    try {
      const shrunk = await shrinkImage(file);
      const imageKey = await api.uploadImage({ matchId }, shrunk);
      const res = await api.sendMessage(matchId, { imageKey });
      append(res.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
      setBusyLabel("");
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function sendLocation() {
    setSending(true);
    setBusyLabel("現在地を取得中…");
    setError("");
    try {
      const point = await currentPosition();
      const res = await api.sendMessage(matchId, { location: point });
      append(res.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
      setBusyLabel("");
    }
  }

  function renderBody(m: Message) {
    if (m.kind === "image" && m.imageUrl) {
      return (
        <a href={m.imageUrl} target="_blank" rel="noreferrer" className="bubble-image">
          <img src={m.imageUrl} alt="送信された画像" loading="lazy" />
        </a>
      );
    }
    if (m.kind === "location" && m.location) {
      return (
        <a
          href={mapLink(m.location)}
          target="_blank"
          rel="noreferrer"
          className="bubble-location"
        >
          <PlaceRoundedIcon fontSize="small" />
          <span>
            <strong>{m.location.name ?? "現在地"}</strong>
            <em>地図で開く</em>
          </span>
        </a>
      );
    }
    return m.text;
  }

  return (
    <div className="chat">
      <header className="chat-head">
        <button className="chat-back" onClick={() => navigate(`/matches/${matchId}`)}>
          <ArrowBackRoundedIcon />
        </button>
        <div className="chat-title">
          <strong>{partner?.displayName ?? "トーク"}</strong>
          {partner && (
            <span>
              {partner.isNew ? "新規" : `★${partner.ratingAvg}（${partner.ratingCount}件）`}
            </span>
          )}
        </div>
      </header>

      <div className="chat-body">
        {loading && <p className="loading">読み込み中…</p>}

        {!loading && messages.length === 0 && (
          <p className="hint chat-empty">
            まだメッセージはありません。
            <br />
            交換したいものと、受け渡しの場所を相談しましょう。
          </p>
        )}

        {messages.map((m) => (
          <div key={m.messageId} className={`bubble-row ${m.mine ? "mine" : "theirs"}`}>
            <div className={`bubble bubble-${m.kind}`}>{renderBody(m)}</div>
            <span className="bubble-time">{timeOf(m.createdAt)}</span>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      {error && <p className="error chat-error">{error}</p>}
      {busyLabel && <p className="notice chat-error">{busyLabel}</p>}

      {canSend ? (
        <div className="chat-input">
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void sendImage(file);
            }}
          />
          <button
            className="chat-tool"
            disabled={sending}
            title="画像を送る"
            onClick={() => fileInput.current?.click()}
          >
            <ImageRoundedIcon />
          </button>
          <button
            className="chat-tool teal"
            disabled={sending}
            title="現在地を送る"
            onClick={() => void sendLocation()}
          >
            <PlaceRoundedIcon />
          </button>

          <textarea
            className="input"
            rows={1}
            value={text}
            maxLength={1000}
            placeholder="メッセージを入力"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // 改行はShift+Enter、送信はEnter
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendText();
              }
            }}
          />
          <button
            className="primary chat-send"
            disabled={sending || !text.trim()}
            onClick={() => void sendText()}
          >
            <SendRoundedIcon />
          </button>
        </div>
      ) : (
        <p className="hint chat-locked">
          双方が「話したい」を送るとトークを始められます。
        </p>
      )}
    </div>
  );
}
