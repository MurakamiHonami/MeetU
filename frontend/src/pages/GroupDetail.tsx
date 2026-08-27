import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import ChatBubbleRoundedIcon from "@mui/icons-material/ChatBubbleRounded";
import CardItem from "../components/CardItem";
import { api, type Group } from "../lib/api";

/** 誰から誰へ何が渡るかを輪の順に並べる */
function CycleDiagram({ group }: { group: Group }) {
  return (
    <div className="cycle">
      {group.steps.map((step, i) => (
        <div key={i} className={`cycle-step ${step.isMine ? "cycle-mine" : ""}`}>
          <div className="cycle-people">
            <strong>{step.isMine ? "あなた" : step.from.displayName}</strong>
            <ArrowDownwardRoundedIcon fontSize="small" />
            <strong>
              {step.to.userId === group.iGiveTo?.userId && step.isMine
                ? step.to.displayName
                : step.to.displayName}
            </strong>
          </div>
          <div className="cycle-item">
            {step.card?.title ?? "（削除されたカード）"}
            {step.matchedTags.length > 0 && (
              <span className="cycle-tags">{step.matchedTags.join(" / ")}</span>
            )}
          </div>
        </div>
      ))}
      <p className="hint cycle-note">
        最後の人から最初の人へ戻るので、全員が 1 つずつ渡して 1 つずつ受け取ります。
      </p>
    </div>
  );
}

export default function GroupDetail() {
  const { groupId = "" } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .group(groupId)
      .then((res) => setGroup(res.group))
      .catch((e) => setError(e.message));
  }, [groupId]);

  async function act(fn: () => Promise<{ group: Group }>, note: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fn();
      setGroup(res.group);
      setMessage(note);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !group) return <p className="error">{error}</p>;
  if (!group) return <p className="loading">読み込み中…</p>;

  const waiting = group.members.length - group.acceptedCount;

  return (
    <div className="page">
      <h2>{group.length}人での交換</h2>

      <p className="matchline">
        <span className={`status status-${group.status}`}>{group.statusLabel}</span>
        {group.status === "NEW" && (
          <span className="hint"> あと {waiting} 人の承諾で成立します</span>
        )}
      </p>

      {/* 自分にとっての損得を最初に見せる */}
      <section className="panel trade-me">
        <div className="trade-row">
          <span className="trade-label give">渡す</span>
          <div>
            <strong>{group.iGive?.title ?? "-"}</strong>
            <span className="hint">→ {group.iGiveTo?.displayName ?? "-"} さんへ</span>
          </div>
        </div>
        <div className="trade-row">
          <span className="trade-label get">受け取る</span>
          <div>
            <strong>{group.iReceive?.title ?? "-"}</strong>
            <span className="hint">← {group.iReceiveFrom?.displayName ?? "-"} さんから</span>
          </div>
        </div>
      </section>

      <h3>交換の流れ</h3>
      <CycleDiagram group={group} />

      {group.iReceive && (
        <>
          <h3>受け取るカード</h3>
          <CardItem card={group.iReceive} />
        </>
      )}

      {message && <p className="notice">{message}</p>}
      {error && <p className="error">{error}</p>}

      {group.status === "NEW" && (
        <section className="panel">
          {group.myAnswer === "accept" ? (
            <p className="hint">
              承諾済みです。ほかの参加者の返事を待っています（あと {waiting} 人）。
            </p>
          ) : (
            <div className="actions">
              <button
                className="primary"
                disabled={busy}
                onClick={() => act(() => api.acceptGroup(groupId), "承諾しました")}
              >
                この交換に参加する
              </button>
              <button
                disabled={busy}
                onClick={() => act(() => api.declineGroup(groupId), "見送りました")}
              >
                見送る
              </button>
            </div>
          )}
        </section>
      )}

      {group.canChat && (
        <section className="panel">
          <p>
            交換が成立しました。<strong>グループトーク</strong>で受け渡しを相談してください。
          </p>
          <div className="actions">
            <button className="primary" onClick={() => navigate(`/groups/${groupId}/chat`)}>
              <ChatBubbleRoundedIcon fontSize="small" /> グループトークを開く
            </button>
          </div>
          {group.status === "ACCEPTED" && (
            <div className="actions">
              <button
                className="teal"
                disabled={busy}
                onClick={() => act(() => api.completeGroup(groupId), "交換を完了にしました")}
              >
                交換が終わった
              </button>
            </div>
          )}
        </section>
      )}

      {group.status === "DECLINED" && (
        <p className="hint">
          参加者が見送ったため、この輪は解散しました。輪は 1 人でも欠けると成立しません。
        </p>
      )}

      <div className="actions">
        <button onClick={() => navigate("/matches")}>マッチ一覧へ戻る</button>
      </div>
    </div>
  );
}
