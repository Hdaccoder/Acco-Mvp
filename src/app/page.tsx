import PopularityExplorer from "@/components/PopularityExplorer";
import { VENUES } from "@/lib/venues";

export default function Page() {
  return <PopularityExplorer mode="nightlife" venues={VENUES} />;
}
