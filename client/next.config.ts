import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for client/Dockerfile (Next standalone server.js)
  output: "standalone",
  allowedDevOrigins: ["moral-sparrow-nationally.ngrok-free.app"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
