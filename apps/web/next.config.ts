import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const monorepoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const nextConfig: NextConfig = {
  // Avoid Turbopack picking C:\Users\AtA from a stray parent pnpm-lock.yaml
  // (that breaks /api/* route discovery while pages still render).
  turbopack: {
    root: monorepoRoot,
  },
  transpilePackages: [
    "@divan/db",
    "@divan/event-store",
    "@divan/temporal-engine",
    "@divan/audit-envelope",
    "@divan/identity-access",
    "@divan/person-employment",
  ],
};

export default nextConfig;
