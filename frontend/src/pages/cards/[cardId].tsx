import { CardDetailView } from "../../widgets/card/CardDetailView";
import { useRouteParam } from "../../shared/lib/navigation";

/**
 * カード ID は実行時に決まるためビルド時に列挙できない。
 * paths を空にして HTML を出力せず、wrangler の SPA fallback で index に回して CSR する。
 */
export function getStaticPaths() {
  return { paths: [], fallback: false };
}

export function getStaticProps() {
  return { props: {} };
}

export default function CardDetail() {
  const { value: cardId, ready } = useRouteParam("cardId");
  if (!ready) return <p className="loading">読み込み中…</p>;
  return <CardDetailView cardId={cardId} />;
}
