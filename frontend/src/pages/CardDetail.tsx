import { useParams } from "react-router-dom";
import { CardDetailView } from "../widgets/card/CardDetailView";

export default function CardDetail() {
  const { cardId = "" } = useParams();
  return <CardDetailView cardId={cardId} />;
}
