import { useEffect, useState } from "react";


export type UserLocation = { lat: number; lng: number; accuracy?: number } | null;


export function useUserLocation() {
const [loc, setLoc] = useState<UserLocation>(null);
const [error, setError] = useState<string | null>(null);


useEffect(() => {
if (!("geolocation" in navigator)) {
setError("Geolocation not supported");
return;
}
navigator.geolocation.getCurrentPosition(
(pos) => setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
(err) => setError(err.message),
{ enableHighAccuracy: false, maximumAge: 60000, timeout: 8000 }
);
}, []);


return { loc, error };
}