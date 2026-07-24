/**
 * Vanilla tRPC client for non-hook callers (command palette search).
 * Shares the same AppRouter as the React provider.
 * Prefer browser use (`searchPersonnel` no-ops on server); URL falls back for
 * module init only — do not rely on SSR without forwarded cookies.
 */
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

import type { AppRouter } from "~/server/root";

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  return process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `http://localhost:${process.env.PORT ?? 3000}`;
}

export const vanillaApi = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: "include",
        });
      },
    }),
  ],
});
