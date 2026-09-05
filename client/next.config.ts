import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for client/Dockerfile (Next standalone server.js)
  output: "standalone",
  poweredByHeader: false,
  allowedDevOrigins: [
    "harmonix.peeporunclub.co.uk",
    "moral-sparrow-nationally.ngrok-free.app", // legacy / rollback tunnel
  ],
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      { source: "/library", destination: "/playlists", permanent: true },
      { source: "/library/:path*", destination: "/playlists/:path*", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/discover",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
