import dynamic from "next/dynamic";

// leaflet は window 依存のため静的書き出し時に評価させない
const NearbyMapView = dynamic(
  () => import("../widgets/nearby/NearbyMapView").then((m) => m.NearbyMapView),
  { ssr: false, loading: () => <p className="loading">読み込み中…</p> },
);

export default function NearbyMap() {
  return <NearbyMapView />;
}
