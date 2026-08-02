import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
  turbopack: {
    resolveAlias: {
      canvas: './src/lib/empty.js',
    },
  },
};

export default nextConfig;
