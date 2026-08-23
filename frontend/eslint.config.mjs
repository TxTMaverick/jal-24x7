import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      /**
       * `react-hooks/set-state-in-effect` — downgraded to a warning.
       *
       * The rule pushes you towards Server Components or a data-fetching
       * library (SWR / React Query) instead of the classic
       * "useEffect -> fetch -> setState" pattern.
       *
       * Every screen here is intentionally a Client Component: the JWT lives
       * in localStorage, so requests must be issued from the browser, and the
       * cart/splash need to hydrate from localStorage after mount (which is
       * only legal inside an effect). None of the flagged sites are bugs --
       * each one either loads data, hydrates client-only storage, or
       * subscribes to a WebSocket.
       *
       * Kept as a warning rather than switched off so the guidance stays
       * visible if this project later adopts SWR or moves reads server-side.
       */
      "react-hooks/set-state-in-effect": "warn",
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
