import { redirect } from "next/navigation";

import {
  getRoleLandingPath,
  recordAccessDenial,
  type CoarseRole,
} from "@divan/identity-access";

import { auth } from "@/auth";
import { AccessDenied } from "@/components/access-denied";
import { PersonnelDictionaryPanel } from "@/components/personnel/personnel-dictionary-panel";
import { PersonnelLifecyclePanel } from "@/components/personnel/personnel-lifecycle-panel";
import { assertPageAccess } from "@/lib/assert-page-access";
import { operationalCopy } from "@/lib/operational-copy";

/**
 * فرهنگ داده — Admin-only (Story 4b.7). Operators get AccessDenied + audit.
 * Hosts legal-hold/disposal governance (Story 7.3 / 9.8 discoverability).
 */
export default async function PersonnelDictionaryPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }

  const coarseRole = session.user.coarseRole as CoarseRole;
  assertPageAccess(coarseRole, "/personnel");

  if (coarseRole !== "hr_admin") {
    await recordAccessDenial({
      accountId: session.user.accountId,
      coarseRole,
      path: "/personnel/dictionary",
    });
    return (
      <AccessDenied landingPath={getRoleLandingPath(coarseRole)} />
    );
  }

  return (
    <div className="space-y-4 px-content-padding-inline py-4">
      <PersonnelDictionaryPanel />
      <div className="space-y-2">
        <p className="text-caption text-text-secondary" role="note">
          {operationalCopy.lifecycleHostPurpose}
        </p>
        <PersonnelLifecyclePanel />
      </div>
    </div>
  );
}
