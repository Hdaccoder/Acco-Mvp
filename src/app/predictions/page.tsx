export const dynamic = "force-dynamic";

import PredictionsClient from "./PredictionsClient";

export default function PredictionsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Tonight’s top picks</h1>
      <p className="text-neutral-400 text-sm">
        We blend live votes with recent nights to predict what’s most likely to be popular.
        Each card shows a score (0–100) and a typical peak time.
      </p>

      <PredictionsClient />

      <div className="pt-4">
        <a
          href="mailto:paul.is.in.power@gmail.com?subject=Acco%20Predictions%20Issue"
          className="text-sm text-neutral-400 underline"
        >
          Report an issue
        </a>
      </div>
    </div>
  );
}
