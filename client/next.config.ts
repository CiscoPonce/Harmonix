import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for client/Dockerfile (Next standalone server.js)
  output: "standalone",
  allowedDevOrigins: [
    "harmonix.peeporunclub.co.uk",
    "moral-sparrow-nationally.ngrok-free.app", // legacy / rollback tunnel
  ],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
