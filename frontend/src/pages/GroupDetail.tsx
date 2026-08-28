import { useParams } from "react-router-dom";
import { GroupDetailView } from "../widgets/group/GroupDetailView";

export default function GroupDetail() {
  const { groupId = "" } = useParams();
  return <GroupDetailView groupId={groupId} />;
}
