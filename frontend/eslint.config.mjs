import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      // Exact local photographs retain full framing; no optimizer/remote-host change in this task.
      "@next/next/no-img-element": "off",
      // Effects synchronize browser storage, media preferences and the existing HTTP API.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    ".next/**",
    ".next-e2e/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);
