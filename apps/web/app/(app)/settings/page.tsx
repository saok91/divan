import { redirect } from "next/navigation";

import type { CoarseRole } from "@divan/identity-access";
import {
  getRoleLandingPath,
  recordAccessDenial,
} from "@divan/identity-access";

import { auth } from "@/auth";
import { AccessDenied } from "@/components/access-denied";
import { defaultSettingsTabHref } from "@/lib/settings-domain-map";
import { assertPageAccess } from "@/lib/assert-page-access";

/**
 * Settings surface root — redirect to role's first visible non-empty tab.
 * Fail closed to AccessDenied when no visible tab exists.
 */
export default async function SettingsIndexPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }

  const coarseRole = session.user.coarseRole as CoarseRole;
  assertPageAccess(coarseRole, "/settings");

  const href = defaultSettingsTabHref(coarseRole);
  if (!href) {
    await recordAccessDenial({
      accountId: session.user.accountId,
      coarseRole,
      path: "/settings",
    });
    return <AccessDenied landingPath={getRoleLandingPath(coarseRole)} />;
  }

  redirect(href);
}
