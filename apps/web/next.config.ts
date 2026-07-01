import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Consume the shared contract package straight from TypeScript source.
  transpilePackages: ["@occa-market/shared"],
};

export default nextConfig;
