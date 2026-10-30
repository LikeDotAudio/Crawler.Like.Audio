import type { NextConfig } from "next";

// crawler.like.audio serves the export from its site root, so by default the
// asset URLs stay root-absolute (/_next/...). The APK.audio OS window serves
// the same export from a deep path, and a root-absolute /_next/ there is the
// apk.audio site root, which has none — every chunk 404s. That build sets
// CRAWLER_BASE_PATH to the folder the window opens (no trailing slash), e.g.
// /APK:Softapps/SCANALYZER_SUITE/SCANALYZER.Like.audio/Crawler.Like.Audio/Thin/out
const basePath = process.env.CRAWLER_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  // A static export: `next build` writes out/ and the app needs no server at
  // all. That is the whole design — Thin does what the Tkinter half does,
  // entirely in the browser, so anything requiring a Node runtime at request
  // time cannot be used here.
  output: "export",
  basePath,
  // basePath moves Next's own URLs only; the tree-sitter files in public/ are
  // fetched by hand-written paths, which read this (src/lib/basePath.ts).
  env: { NEXT_PUBLIC_BASE_PATH: basePath ?? "" },
  // `canvas` is aliased away in BOTH bundlers, and it must stay in both.
  //
  // pdfjs-dist declares an optional dependency on node-canvas for rendering
  // PDFs outside a browser. We only ever render into a real <canvas> in the
  // page, so that path is dead code — but the bundler still tries to resolve
  // it, and node-canvas is a native binding that cannot be built into a static
  // export. Aliasing it to `false` (webpack) and to an empty module (turbopack,
  // which has no `false`) is the standard workaround.
  //
  // Remove either half and the build fails only in the bundler you did not
  // test, which is why the reason is written here rather than remembered.
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
