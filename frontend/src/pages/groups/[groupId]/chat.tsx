import { GroupChatThread } from "../../../widgets/chat/GroupChatThread";
import { useNavigate, useRouteParam } from "../../../shared/lib/navigation";

export function getStaticPaths() {
  return { paths: [], fallback: false };
}

export function getStaticProps() {
  return { props: {} };
}

export default function GroupChat() {
  const { value: groupId, ready } = useRouteParam("groupId");
  const navigate = useNavigate();

  if (!ready) return <p className="loading">読み込み中…</p>;
  return <GroupChatThread groupId={groupId} onBack={() => navigate(`/groups/${groupId}`)} />;
}
