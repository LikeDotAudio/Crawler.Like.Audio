import type { NextConfig } from "next";

// crawler.like.audio serves the export from its site root, so by default the
// asset URLs stay root-absolute (/_next/...). The APK.audio OS window serves
// the same export from a deep path, and a root-absolute /_next/ there is the
// apk.audio site root, which has none — every chunk 404s. That build sets
// CRAWLER_BASE_PATH to the folder the window opens (no trailing slash), e.g.
// /APK:Softapps/SCANALYZER_SUITE/SCANALYZER.Like.audio/Crawler.Like.Audio/Thin/out
const basePath = process.env.CRAWLER_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  // basePath moves Next's own URLs only; the tree-sitter files in public/ are
  // fetched by hand-written paths, which read this (src/lib/basePath.ts).
  env: { NEXT_PUBLIC_BASE_PATH: basePath ?? "" },
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
