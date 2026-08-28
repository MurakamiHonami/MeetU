import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import { matchApi } from "../../features/match/api";
import { groupApi } from "../../features/group/api";
import { TYPE_LABEL } from "../../entities/card/model";
import type { Group } from "../../entities/group/model";
import type { Match } from "../../entities/match/model";

export function MatchesList() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    matchApi
      .matches()
      .then((res) => setMatches(res.matches))
      .catch((e) => setError(e.message));
    // 環状交換の提案も同じ画面にまとめる
    groupApi
      .groups()
      .then((res) => setGroups(res.groups))
      .catch(() => setGroups([]));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!matches) return <p className="loading">読み込み中…</p>;

  return (
    <div className="page">
      <h2>マッチ一覧</h2>

      {groups.length > 0 && (
        <section className="group-list">
          <h3>交換の輪</h3>
          {groups.map((group) => (
            <article
              key={group.groupId}
              className="card card-clickable group-card"
              onClick={() => navigate(`/groups/${group.groupId}`)}
            >
              <div className="card-head">
                <span className="badge badge-COMPANION">
                  <GroupsRoundedIcon fontSize="inherit" /> {group.length}人
                </span>
                <h3>
                  {group.iReceive?.title ?? "交換の輪"}
                </h3>
                <span className={`status status-${group.status}`}>{group.statusLabel}</span>
              </div>
              <p className="matchline">
                渡す: <strong>{group.iGive?.title ?? "-"}</strong>
              </p>
              <p className="hint">
                受け取る: {group.iReceive?.title ?? "-"}（{group.iReceiveFrom?.displayName} さん）
              </p>
              {group.status === "NEW" && (
                <p className="notice">
                  {group.myAnswer === "accept"
                    ? `承諾済み・あと ${group.members.length - group.acceptedCount} 人待ち`
                    : "参加するか選んでください"}
                </p>
              )}
            </article>
          ))}
        </section>
      )}

      {matches.length === 0 && groups.length === 0 && (
        <p className="hint">
          まだマッチはありません。カードを登録しておくと、条件が一致したときに通知します。
        </p>
      )}

      {matches.length > 0 && <h3>1対1のマッチ</h3>}

      {matches.map((match) => (
        <article
          key={match.matchId}
          className="card card-clickable"
          onClick={() => navigate(`/matches/${match.matchId}`)}
        >
          <div className="card-head">
            <span className={`status status-${match.status}`}>{match.statusLabel}</span>
            <h3>
              {match.iReceive ?? match.partnerCard
                ? `${TYPE_LABEL[(match.iReceive ?? match.partnerCard)!.type]}${
                    (match.iReceive ?? match.partnerCard)!.title
                  }`
                : "（相手のカードは削除されました）"}
            </h3>
          </div>

          {match.iGive && (
            <p className="hint">渡す: {match.iGive.title}</p>
          )}
          <p className="matchline">
            タグ <strong>{match.matchCount}件</strong> 一致
            {match.distanceLabel && <span className="distance"> 約{match.distanceLabel}</span>}
          </p>
          <div className="chips chips-sm">
            {match.matchedTags.map((tag) => (
              <span key={tag} className="chip chip-matched">
                {tag}
              </span>
            ))}
          </div>

          {match.partner && (
            <p className="card-owner">
              {match.partner.displayName}
              {match.partner.isNew ? (
                <span className="tagline tagline-new">新規</span>
              ) : (
                <span className="tagline">
                  ★{match.partner.ratingAvg}（{match.partner.ratingCount}件）
                </span>
              )}
            </p>
          )}

          {match.lastMessagePreview && (
            <p className={`chat-preview ${match.hasUnread ? "unread" : ""}`}>
              {match.hasUnread && <span className="unread-dot">●</span>}
              {match.lastMessagePreview}
            </p>
          )}

          {match.acceptedByPartner && !match.acceptedByMe && (
            <p className="notice">相手が「話したい」を送っています</p>
          )}
        </article>
      ))}
    </div>
  );
}
