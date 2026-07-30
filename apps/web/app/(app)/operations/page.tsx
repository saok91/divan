import { redirect } from "next/navigation";

import { LaunchArtifactPanel } from "@/components/operations/launch-artifact-panel";
import { OperationsHealthPanel } from "@/components/operations/operations-health-panel";
import { auth } from "@/auth";
import { assertPageAccess } from "@/lib/assert-page-access";

/**
 * Operations health surface (Story 7.2 / FR-45 / UJ-5) +
 * Launch Artifact Register panel (Story 7.7 / FR-55).
 * Layout≠RSC: assertPageAccess before load — coarse system_admin nav alone
 * is insufficient for tRPC; fine permission enforced on procedures.
 * Gate: identity/config/health only — never an HR browser.
 */
export default async function OperationsPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }
  assertPageAccess(session.user.coarseRole, "/operations");

  return (
    <div className="space-y-10">
      <OperationsHealthPanel />
      <LaunchArtifactPanel />
    </div>
  );
}
