/** @type {import('next').NextConfig} */
const nextConfig = {
experimental: {
optimizePackageImports: ["react-leaflet", "leaflet"]
},
async headers() {
return [
{
source: "/(.*)",
headers: [
{ key: "Permissions-Policy", value: "geolocation=(self)" }
]
}
];
}
};
export default nextConfig;