import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the project root (another package-lock.json exists higher up on this PC).
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
