import { useCallback, useEffect, useRef, useState } from "react";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { groupApi } from "../../features/group/api";
import { uploadApi } from "../../features/upload/api";
import type { Message } from "../../entities/message/model";
import type { Owner } from "../../entities/user/model";
import { currentPosition, shrinkImage } from "../../shared/lib/device";
import { ChatComposer } from "./ChatComposer";
import { formatMessageTime, MessageContent } from "./MessageContent";

const POLL_MS = 4000;

type GroupMessage = Message & { sender: Owner };

type Props = {
  groupId: string;
  onBack: () => void;
};

export function GroupChatThread({ groupId, onBack }: Props) {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [members, setMembers] = useState<Owner[]>([]);
  const [canSend, setCanSend] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [error, setError] = useState("");

  const bottom = useRef<HTMLDivElement>(null);
  const lastId = useRef<string | undefined>(undefined);

  const load = useCallback(
    async (initial: boolean) => {
      try {
        const res = await groupApi.groupMessages(groupId, initial ? undefined : lastId.current);
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
    },
    [groupId],
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

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages]);

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
      const res = await groupApi.sendGroupMessage(groupId, { text: body });
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
      const imageKey = await uploadApi.uploadImage({ groupId }, shrunk);
      const res = await groupApi.sendGroupMessage(groupId, { imageKey });
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
      const res = await groupApi.sendGroupMessage(groupId, { location: point });
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
              <div className={`bubble bubble-${m.kind}`}>
                <MessageContent message={m} />
              </div>
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
        lockedMessage="全員が承諾するとトークを始められます。"
        onTextChange={setText}
        onSendText={() => void sendText()}
        onSendImage={(file) => void sendImage(file)}
        onSendLocation={() => void sendLocation()}
      />
    </div>
  );
}
