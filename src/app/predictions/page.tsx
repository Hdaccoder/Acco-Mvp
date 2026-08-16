import PredictionExplorer from "@/components/PredictionExplorer";
import { VENUES } from "@/lib/venues";

export default function PredictionsPage() {
  return <PredictionExplorer mode="nightlife" venues={VENUES} />;
}
