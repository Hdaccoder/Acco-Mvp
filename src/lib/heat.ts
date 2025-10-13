export type WeightInput = {
intent: "yes" | "maybe";
metersFromVenue: number;
updatedAgoMinutes: number;
};


export function weight({ intent, metersFromVenue, updatedAgoMinutes }: WeightInput) {
const intentW = intent === "yes" ? 1.0 : 0.6;
const km = metersFromVenue / 1000;
const proximityW = km <= 1 ? 1.0 : km <= 3 ? 0.85 : 0.7;
const recencyW = updatedAgoMinutes <= 120 ? 1.0 : updatedAgoMinutes <= 240 ? 0.8 : 0.6;
return 1 * intentW * proximityW * recencyW;
}