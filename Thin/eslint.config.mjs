import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored third-party bundle served as-is (tree-sitter runtime).
    "public/web-tree-sitter.js",
    // pdf.js worker copied from node_modules (npm run sync:pdf-worker).
    "public/pdf.worker.min.js",
  ]),
  // CommonJS test shims (test/*.cjs) load the shared APKTable into a vm sandbox:
  // require() is how a .cjs file imports, and the shim's prototype glue keeps
  // `this` on purpose. TypeScript-style rules do not apply to them.
  {
    files: ["test/**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-this-alias": "off",
    },
  },
]);

export default eslintConfig;
