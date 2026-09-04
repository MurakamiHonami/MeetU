import { useEffect, useState } from "react";
import { useNavigate } from "../../shared/lib/navigation";
import ChatBubbleRoundedIcon from "@mui/icons-material/ChatBubbleRounded";
import CardItem from "../CardItem";
import { matchApi } from "../../features/match/api";
import { reviewApi, type ReportReason } from "../../features/review/api";
import type { Match } from "../../entities/match/model";

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "NOT_DELIVERED", label: "商品が届かない" },
  { value: "ITEM_CONDITION", label: "商品の状態が説明と違う" },
  { value: "HARASSMENT", label: "迷惑行為・暴言" },
  { value: "FRAUD", label: "詐欺の疑い" },
  { value: "NO_SHOW", label: "当日来なかった" },
  { value: "OTHER", label: "その他" },
];

type Props = { matchId: string };

export function MatchDetailView({ matchId }: Props) {
  const navigate = useNavigate();
  const [match, setMatch] = useState<Match | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewed, setReviewed] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0].value);
  const [detail, setDetail] = useState("");

  useEffect(() => {
    matchApi
      .match(matchId)
      .then((res) => setMatch(res.match))
      .catch((e) => setError(e.message));
  }, [matchId]);

  async function act(fn: () => Promise<{ match: Match }>, note: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fn();
      setMatch(res.match);
      setMessage(note);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitReview() {
    setBusy(true);
    setError("");
    try {
      await reviewApi.review({ matchId, rating, comment: comment.trim() || undefined });
      setReviewed(true);
      setMessage("評価を送信しました");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitReport() {
    if (!match?.partner) return;
    setBusy(true);
    setError("");
    try {
      const res = await reviewApi.report({
        targetUserId: match.partner.userId,
        matchId,
        reason,
        detail: detail.trim() || undefined,
      });
      setReportOpen(false);
      setDetail("");
      setMessage(res.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !match) return <p className="error">{error}</p>;
  if (!match) return <p className="loading">読み込み中…</p>;

  return (
    <div className="page">
      <h2>マッチの詳細</h2>

      <p className="matchline">
        タグ <strong>{match.matchCount}件</strong> 一致 ・{" "}
        <span className={`status status-${match.status}`}>{match.statusLabel}</span>
      </p>
      <div className="chips chips-sm">
        {match.matchedTags.map((tag) => (
          <span key={tag} className="chip chip-matched">
            {tag}
          </span>
        ))}
      </div>

      <section className="panel trade-me">
        <div className="trade-row">
          <span className="trade-label get">受け取る</span>
          <div>
            <strong>{match.iReceive?.title ?? match.partnerCard?.title ?? "-"}</strong>
            <span className="hint">← {match.partner?.displayName ?? "-"} さんから</span>
          </div>
        </div>
        <div className="trade-row">
          <span className="trade-label give">渡す</span>
          <div>
            <strong>{match.iGive?.title ?? match.myCard?.title ?? "-"}</strong>
            <span className="hint">→ {match.partner?.displayName ?? "-"} さんへ</span>
          </div>
        </div>
      </section>

      <h3>受け取るカード</h3>
      {(match.iReceive ?? match.partnerCard) ? (
        <CardItem
          card={{ ...(match.iReceive ?? match.partnerCard)!, owner: match.partner ?? undefined }}
        />
      ) : (
        <p className="hint">相手のカードは削除されています。</p>
      )}

      <h3>渡すカード</h3>
      {(match.iGive ?? match.myCard) ? (
        <CardItem card={(match.iGive ?? match.myCard)!} />
      ) : (
        <p className="hint">削除済みです。</p>
      )}

      {message && <p className="notice">{message}</p>}
      {error && <p className="error">{error}</p>}

      {match.status === "PENDING" && (
        <section className="panel">
          {match.acceptedByMe ? (
            <p className="hint">相手の返事を待っています。</p>
          ) : (
            <>
              {match.acceptedByPartner && (
                <p className="notice">相手が「話したい」を送っています</p>
              )}
              <div className="actions">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => act(() => matchApi.accept(matchId), "相手に通知しました")}
                >
                  話したい
                </button>
                <button
                  disabled={busy}
                  onClick={() => act(() => matchApi.decline(matchId), "辞退しました")}
                >
                  今回は見送る
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {match.canChat && (
        <section className="panel">
          <p>
            お互いに承諾しました。<strong>アプリ内のトーク</strong>でやり取りできます。
            金銭のやり取りはせず、物々交換のみでお願いします。
          </p>
          <div className="actions">
            <button className="primary" onClick={() => navigate(`/matches/${matchId}/chat`)}>
              <ChatBubbleRoundedIcon fontSize="small" /> トークを開く
            </button>
          </div>
        </section>
      )}

      {match.status === "ACCEPTED" && (
        <section className="panel">
          <div className="actions">
            <button
              className="teal"
              disabled={busy}
              onClick={() => act(() => matchApi.complete(matchId), "取引を完了にしました")}
            >
              取引が終わった
            </button>
          </div>
        </section>
      )}

      {match.status === "COMPLETED" && !reviewed && (
        <section className="panel">
          <h3>相手を評価する</h3>
          <div className="stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={n <= rating ? "star on" : "star"}
                onClick={() => setRating(n)}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            className="input"
            rows={3}
            maxLength={200}
            value={comment}
            placeholder="やり取りが丁寧でした など（任意）"
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="actions">
            <button className="primary" disabled={busy} onClick={submitReview}>
              評価を送る
            </button>
          </div>
        </section>
      )}

      <section className="panel panel-quiet">
        {reportOpen ? (
          <>
            <h3>この相手を通報する</h3>
            <select
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportReason)}
            >
              {REPORT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <textarea
              className="input"
              rows={3}
              maxLength={500}
              value={detail}
              placeholder="状況を具体的に書いてください（任意）"
              onChange={(e) => setDetail(e.target.value)}
            />
            <div className="actions">
              <button className="danger" disabled={busy} onClick={submitReport}>
                通報する
              </button>
              <button onClick={() => setReportOpen(false)}>やめる</button>
            </div>
          </>
        ) : (
          <button className="link" onClick={() => setReportOpen(true)}>
            問題があったので通報する
          </button>
        )}
      </section>

      <div className="actions">
        <button onClick={() => navigate("/matches")}>マッチ一覧へ戻る</button>
      </div>
    </div>
  );
}
