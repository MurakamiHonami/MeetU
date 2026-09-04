import { GroupDetailView } from "../../widgets/group/GroupDetailView";
import { useRouteParam } from "../../shared/lib/navigation";

export function getStaticPaths() {
  return { paths: [], fallback: false };
}

export function getStaticProps() {
  return { props: {} };
}

export default function GroupDetail() {
  const { value: groupId, ready } = useRouteParam("groupId");
  if (!ready) return <p className="loading">読み込み中…</p>;
  return <GroupDetailView groupId={groupId} />;
}
