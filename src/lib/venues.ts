export type Venue = {
id: string;
name: string;
lat: number;
lng: number;
baseline?: number;
};


// Approximate coords centered around Ormskirk (replace with precise later)
export const ORMSKIRK_CENTER = { lat: 53.568, lng: -2.887 };


export const VENUES: Venue[] = [
{ id: "wetherspoons", name: "Wetherspoons (Court Leet)", lat: 53.5686, lng: -2.8849, baseline: 6 },
{ id: "styles-bar", name: "Styles Bar", lat: 53.5692, lng: -2.8856, baseline: 5 },
{ id: "alpine-club-lodge", name: "Alpine Club Lodge", lat: 53.5681, lng: -2.8867, baseline: 5 },
{ id: "lime-tyger", name: "Lime Tyger", lat: 53.5690, lng: -2.8861, baseline: 5 },
{ id: "edge-hill-su", name: "Edge Hill Student Union", lat: 53.5609, lng: -2.8723, baseline: 7 }
];