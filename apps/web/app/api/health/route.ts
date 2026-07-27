/**
 * Redacted readiness for external monitors (Story 7.2 / FR-45).
 * Not a substitute for the permissioned /operations UI.
 * force-dynamic, no-store; 200 vs 503; no HR fields or secrets.
 */

import { checkDatabaseConnectivity } from "@divan/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStoreHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Content-Type": "application/json; charset=utf-8",
  };
}

export async function GET() {
  const url = process.env.DATABASE_URL?.trim() ?? "";
  const dbOk = url ? await checkDatabaseConnectivity(url) : false;

  // Liveness of process is implied by response; readiness keys off DB.
  // Do not disclose identity provider mode on the public monitor route.
  const body = {
    status: dbOk ? ("ready" as const) : ("not_ready" as const),
    app: "دیوان",
    checks: {
      database: dbOk ? ("ok" as const) : ("down" as const),
    },
  };

  return new Response(JSON.stringify(body), {
    status: dbOk ? 200 : 503,
    headers: noStoreHeaders(),
  });
}
