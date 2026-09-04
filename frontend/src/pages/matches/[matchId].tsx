import { MatchDetailView } from "../../widgets/match/MatchDetailView";
import { useRouteParam } from "../../shared/lib/navigation";

export function getStaticPaths() {
  return { paths: [], fallback: false };
}

export function getStaticProps() {
  return { props: {} };
}

export default function MatchDetail() {
  const { value: matchId, ready } = useRouteParam("matchId");
  if (!ready) return <p className="loading">読み込み中…</p>;
  return <MatchDetailView matchId={matchId} />;
}
