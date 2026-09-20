import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  experimental: {},
  // headers() removed for static export compatibility
};

export default nextConfig;
