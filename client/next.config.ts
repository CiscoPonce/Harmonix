import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['moral-sparrow-nationally.ngrok-free.app'],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
