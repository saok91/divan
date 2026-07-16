import type { ReactNode } from "react";

import {
  canAccessPath,
  getRoleLandingPath,
  recordAccessDenial,
  type CoarseRole,
} from "@divan/identity-access";

import { AccessDenied } from "@/components/access-denied";

type GuardResult =
  | { kind: "allow" }
  | { kind: "deny"; landingPath: string; ui: ReactNode };

/**
 * Server-side coarse path gate for `(app)` routes.
 * Renders denial UI (does not silent-redirect) and records FR42 substrate.
 */
export async function resolveAppPathAccess(input: {
  coarseRole: CoarseRole;
  accountId: string;
  pathname: string;
}): Promise<GuardResult> {
  const { coarseRole, accountId, pathname } = input;

  if (canAccessPath(coarseRole, pathname)) {
    return { kind: "allow" };
  }

  const landingPath = getRoleLandingPath(coarseRole);
  await recordAccessDenial({
    accountId,
    coarseRole,
    path: pathname,
  });

  return {
    kind: "deny",
    landingPath,
    ui: <AccessDenied landingPath={landingPath} />,
  };
}
