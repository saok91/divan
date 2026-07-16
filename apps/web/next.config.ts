import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@divan/db",
    "@divan/event-store",
    "@divan/temporal-engine",
    "@divan/audit-envelope",
    "@divan/identity-access",
  ],
};

export default nextConfig;
