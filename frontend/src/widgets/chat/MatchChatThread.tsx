import { useCallback, useEffect, useRef, useState } from "react";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { matchApi } from "../../features/match/api";
import { uploadApi } from "../../features/upload/api";
import type { Message } from "../../entities/message/model";
import type { Owner } from "../../entities/user/model";
import { currentPosition, shrinkImage } from "../../shared/lib/device";
import { ChatComposer } from "./ChatComposer";
import { formatMessageTime, MessageContent } from "./MessageContent";

const POLL_MS = 4000;

type Props = {
  matchId: string;
  onBack: () => void;
};

export function MatchChatThread({ matchId, onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [partner, setPartner] = useState<Owner | null>(null);
  const [canSend, setCanSend] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [error, setError] = useState("");

  const bottom = useRef<HTMLDivElement>(null);
  const lastId = useRef<string | undefined>(undefined);

  const scrollToBottom = useCallback(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, []);

  const load = useCallback(
    async (initial: boolean) => {
      try {
        const res = await matchApi.messages(matchId, initial ? undefined : lastId.current);
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
    },
    [matchId],
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    let timer: number | undefined;

    const stop = () => {
      if (timer === undefined) return;
      window.clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      if (timer !== undefined) return;
      timer = window.setInterval(() => void load(false), POLL_MS);
    };
    const handleVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        void load(false);
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
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
      const res = await matchApi.sendMessage(matchId, { text: body });
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
      const imageKey = await uploadApi.uploadImage({ matchId }, shrunk);
      const res = await matchApi.sendMessage(matchId, { imageKey });
      append(res.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
      setBusyLabel("");
    }
  }

  async function sendLocation() {
    setSending(true);
    setBusyLabel("現在地を取得中…");
    setError("");
    try {
      const point = await currentPosition();
      const res = await matchApi.sendMessage(matchId, { location: point });
      append(res.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
      setBusyLabel("");
    }
  }

  return (
    <div className="chat">
      <header className="chat-head">
        <button type="button" className="chat-back" onClick={onBack}>
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
            <div className={`bubble bubble-${m.kind}`}>
              <MessageContent message={m} />
            </div>
            <span className="bubble-time">{formatMessageTime(m.createdAt)}</span>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      {error && <p className="error chat-error">{error}</p>}

      <ChatComposer
        text={text}
        sending={sending}
        busyLabel={busyLabel}
        canSend={canSend}
        lockedMessage="双方が「話したい」を送るとトークを始められます。"
        onTextChange={setText}
        onSendText={() => void sendText()}
        onSendImage={(file) => void sendImage(file)}
        onSendLocation={() => void sendLocation()}
      />
    </div>
  );
}
