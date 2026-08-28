import { useNavigate, useParams } from "react-router-dom";
import { MatchChatThread } from "../widgets/chat/MatchChatThread";

export default function Chat() {
  const { matchId = "" } = useParams();
  const navigate = useNavigate();

  return <MatchChatThread matchId={matchId} onBack={() => navigate(`/matches/${matchId}`)} />;
}
