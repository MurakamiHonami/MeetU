import { MatchChatThread } from "../../../widgets/chat/MatchChatThread";
import { useNavigate, useRouteParam } from "../../../shared/lib/navigation";

export function getStaticPaths() {
  return { paths: [], fallback: false };
}

export function getStaticProps() {
  return { props: {} };
}

export default function Chat() {
  const { value: matchId, ready } = useRouteParam("matchId");
  const navigate = useNavigate();

  if (!ready) return <p className="loading">読み込み中…</p>;
  return <MatchChatThread matchId={matchId} onBack={() => navigate(`/matches/${matchId}`)} />;
}
