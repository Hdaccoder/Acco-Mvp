import { dirname } from 'path';
import { fileURLToPath } from 'url';

/** @type {import('next').NextConfig} */
const __dirname = dirname(fileURLToPath(import.meta.url));


const nextConfig = {
  experimental: {
    turbo: false,
    optimizePackageImports: ["react-leaflet", "leaflet"],
  },
	async headers() {
		return [
			{
				source: "/(.*)",
				headers: [{ key: "Permissions-Policy", value: "geolocation=(self)" }],
			},
		];
	},
};

export default nextConfig;