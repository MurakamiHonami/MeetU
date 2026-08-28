import { useParams } from "react-router-dom";
import { MatchDetailView } from "../widgets/match/MatchDetailView";

export default function MatchDetail() {
  const { matchId = "" } = useParams();
  return <MatchDetailView matchId={matchId} />;
}
