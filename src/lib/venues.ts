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
{ id: "wetherspoons", name: "Wetherspoons (Court Leet)", lat: 53.568070, lng: -2.885286, baseline: 6 },
{ id: "styles-bar", name: "Styles Bar", lat: 53.568418, lng: -2.885864, baseline: 5 },
{ id: "alpine-club-lodge", name: "Alpine Club Lodge", lat: 53.568039, lng: -2.883166, baseline: 5 },
{ id: "lime-tyger", name: "Lime Tyger", lat: 53.566594, lng: -2.883446, baseline: 5 },
{ id: "edge-hill-su", name: "Edge Hill Student Union", lat: 53.56020, lng: -2.87287, baseline: 7 },
{ id: "cricketers", name: "The Cricketers", lat: 53.56555, lng: -2.88360 },
{ id: "spiritz", name: "Spiritz", lat: 53.56861, lng: -2.88468 },
{ id: "number-12-bar", name: "Number Twelve Bar", lat: 53.56778, lng: -2.88641 },
{ id: "murphys-irish-bar", name: "Murphy's Irish Bar", lat: 53.56692, lng: -2.88621 },
{ id: "queens-head", name: "Queens Head", lat: 53.56695, lng: -2.88448 },
{ id: "nordico-lounge", name: "Nordico Lounge", lat: 53.56700, lng: -2.88485 },
{ id: "the-green-room", name: "The Green Room", lat: 53.56710, lng: -2.88416 },
{ id: "the-golden-lion", name: "The Golden Lion", lat: 53.56706, lng: -2.88391 },
{ id: "tap-room", name: "Tap Room",lat: 53.56776, lng: -2.88566 },
{ id: "liquid-bar", name: "Liquid Bar",lat: 53.566720, lng: -2.883420 },
{ id: "tiny-tavern", name: "Tiny Tavern",lat: 53.56787, lng: -2.88574 }
];