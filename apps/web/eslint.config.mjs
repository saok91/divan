import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/** @type {import("eslint").Linter.Config[]} */
const config = [
  {
    ignores: [".next/**", "node_modules/**", "out/**"],
  },
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@prisma/client",
              message:
                "Do not import @prisma/client from apps/web. Use @divan/db (and module APIs) instead.",
            },
            {
              name: ".prisma/client",
              message:
                "Do not import generated Prisma client from apps/web. Use @divan/db instead.",
            },
          ],
          patterns: [
            {
              group: ["**/node_modules/.prisma/**", "**/generated/prisma/**"],
              message:
                "Do not import generated Prisma client paths from apps/web.",
            },
          ],
        },
      ],
    },
  },
];

export default config;
