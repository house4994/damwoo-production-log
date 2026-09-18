import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.VERCEL ? ".next" : "dist",
};

export default nextConfig;
