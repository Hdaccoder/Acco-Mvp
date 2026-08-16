import PopularityExplorer from "@/components/PopularityExplorer";
import { FOOD_VENUES } from "@/lib/food_venues";

export default function FoodPage() {
  return <PopularityExplorer mode="food" venues={FOOD_VENUES} />;
}
