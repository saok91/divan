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

/**
 * فرهنگ داده — Admin-only (Story 4b.7). Operators get AccessDenied + audit.
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
    <div className="space-y-2 px-content-padding-inline py-4">
      <PersonnelDictionaryPanel />
      <PersonnelLifecyclePanel />
    </div>
  );
}
