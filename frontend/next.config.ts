import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // LAN / Oracle access during next dev (not just localhost)
  allowedDevOrigins: ["10.200.200.2", "127.0.0.1", "localhost"],
  async rewrites() {
    const backend = process.env.API_PROXY_TARGET || "http://127.0.0.1:8100";
    return [
      { source: "/api/:path*", destination: `${backend}/:path*` },
      {
        source: "/moon-tiles/:path*",
        destination: "https://trek.nasa.gov/tiles/:path*",
      },
    ];
  },
};

export default nextConfig;
