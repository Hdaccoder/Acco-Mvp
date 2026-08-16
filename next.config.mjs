/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ["react-leaflet", "leaflet"],
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Permissions-Policy", value: "geolocation=(self)" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    }];
  },
};

export default nextConfig;
