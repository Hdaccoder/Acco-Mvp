// Avoid aggressive claiming in development (localhost), to prevent dev caching issues.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
	// If running on localhost during development, do not claim clients.
	const hostname = self.location && self.location.hostname;
	if (hostname === 'localhost' || hostname === '127.0.0.1') {
		return;
	}
	e.waitUntil(clients.claim());
});