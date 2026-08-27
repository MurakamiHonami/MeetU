import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import { api, type Message, type Owner } from "../lib/api";
import { currentPosition, mapLink, shrinkImage } from "../lib/device";

const POLL_MS = 4000;

type GroupMessage = Message & { sender: Owner };

function timeOf(iso: string) {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 3〜4 人のトーク。1 対 1 と違い、誰の発言かを名前で出す。 */
export default function GroupChat() {
  const { groupId = "" } = useParams();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [members, setMembers] = useState<Owner[]>([]);
  const [canSend, setCanSend] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [error, setError] = useState("");

  const bottom = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const lastId = useRef<string | undefined>(undefined);

  const load = useCallback(async (initial: boolean) => {
    try {
      const res = await api.groupMessages(groupId, initial ? undefined : lastId.current);
      if (initial) {
        setMessages(res.messages);
        setMembers(res.members);
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
  }, [groupId]);

  useEffect(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => void load(false), POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  // 送信直後はサーバから sender が返らないので、自分の情報で補う
  function append(message: Message) {
    const me = members.find((m) => m.userId) ?? null;
    setMessages((prev) => [...prev, { ...message, sender: me as Owner }]);
    lastId.current = message.messageId;
  }

  async function sendText() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await api.sendGroupMessage(groupId, { text: body });
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
      const imageKey = await api.uploadImage({ groupId }, shrunk);
      const res = await api.sendGroupMessage(groupId, { imageKey });
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
      const res = await api.sendGroupMessage(groupId, { location: point });
      append(res.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
      setBusyLabel("");
    }
  }

  function renderBody(m: GroupMessage) {
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
    return m.text;
  }

  return (
    <div className="chat">
      <header className="chat-head">
        <button className="chat-back" onClick={() => navigate(`/groups/${groupId}`)}>
          <ArrowBackRoundedIcon />
        </button>
        <div className="chat-title">
          <strong>{members.length}人のグループ</strong>
          <span>{members.map((m) => m.displayName).join(" ・ ")}</span>
        </div>
      </header>

      <div className="chat-body">
        {loading && <p className="loading">読み込み中…</p>}

        {!loading && messages.length === 0 && (
          <p className="hint chat-empty">
            まだメッセージはありません。
            <br />
            受け渡しの日時と場所を決めましょう。
          </p>
        )}

        {messages.map((m) => (
          <div key={m.messageId} className={`bubble-row ${m.mine ? "mine" : "theirs"}`}>
            <div className="bubble-wrap">
              {!m.mine && <span className="bubble-name">{m.sender?.displayName ?? "参加者"}</span>}
              <div className={`bubble bubble-${m.kind}`}>{renderBody(m)}</div>
            </div>
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
        <p className="hint chat-locked">全員が承諾するとトークを始められます。</p>
      )}
    </div>
  );
}
