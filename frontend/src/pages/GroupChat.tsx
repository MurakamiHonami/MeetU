import { useNavigate, useParams } from "react-router-dom";
import { GroupChatThread } from "../widgets/chat/GroupChatThread";

export default function GroupChat() {
  const { groupId = "" } = useParams();
  const navigate = useNavigate();

  return (
    <GroupChatThread
      groupId={groupId}
      onBack={() => navigate(`/groups/${groupId}`)}
    />
  );
}
