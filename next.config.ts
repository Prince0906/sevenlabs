import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Required for Docker multi-stage builds
  transpilePackages: ["@sevenlabs/coach-core", "@sevenlabs/shared-types"],
};

export default nextConfig;
