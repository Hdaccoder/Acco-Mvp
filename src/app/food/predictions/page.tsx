import PredictionExplorer from "@/components/PredictionExplorer";
import { FOOD_VENUES } from "@/lib/food_venues";

export default function FoodPredictionsPage() {
  return <PredictionExplorer mode="food" venues={FOOD_VENUES} />;
}
