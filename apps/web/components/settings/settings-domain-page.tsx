/**
 * Shared gate for settings domain tab pages (Story 10.2).
 * Out-of-role or empty-domain deep links → AccessDenied + audit (no silent coerce).
 */

import { redirect } from "next/navigation";

import type { SettingsOwningDomain } from "@divan/app-settings";
import {
  getRoleLandingPath,
  recordAccessDenial,
  type CoarseRole,
} from "@divan/identity-access";

import { auth } from "@/auth";
import { AccessDenied } from "@/components/access-denied";
import { SettingsDomainPanel } from "@/components/settings/settings-domain-panel";
import { assertPageAccess } from "@/lib/assert-page-access";
import {
  domainHasRegistryKeys,
  roleMaySeeDomain,
} from "@/lib/settings-domain-map";

export async function renderSettingsDomainPage(
  domain: SettingsOwningDomain,
  path: string,
): Promise<React.ReactNode> {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }

  const coarseRole = session.user.coarseRole as CoarseRole;
  assertPageAccess(coarseRole, "/settings");

  const allowed =
    roleMaySeeDomain(coarseRole, domain) && domainHasRegistryKeys(domain);

  if (!allowed) {
    await recordAccessDenial({
      accountId: session.user.accountId,
      coarseRole,
      path,
    });
    return <AccessDenied landingPath={getRoleLandingPath(coarseRole)} />;
  }

  return (
    <div className="px-content-padding-inline py-4">
      <SettingsDomainPanel domain={domain} />
    </div>
  );
}
