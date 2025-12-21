import { useEffect, useState } from "react";


export type UserLocation = { lat: number; lng: number; accuracy?: number } | null;


export function useUserLocation() {
	const [loc, setLoc] = useState<UserLocation>(null);
	const [error, setError] = useState<string | null>(null);

	const doRequest = (opts?: PositionOptions) => {
		if (!('geolocation' in navigator)) {
			setError('Geolocation not supported');
			return;
		}
		try {
			navigator.geolocation.getCurrentPosition(
				(pos) => {
					setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
					setError(null);
				},
				(err) => setError(err?.message ?? String(err)),
				{ enableHighAccuracy: false, maximumAge: 60000, timeout: 8000, ...(opts || {}) }
			);
		} catch (e) {
			setError(String(e));
		}
	};

	useEffect(() => {
		doRequest();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return { loc, error, requestLocation: doRequest };
}