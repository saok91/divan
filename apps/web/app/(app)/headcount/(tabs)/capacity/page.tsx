import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { HeadcountApprovalPanel } from "@/components/headcount/approval-panel";
import { HeadcountExemptionPanel } from "@/components/headcount/exemption-panel";
import { HeadcountOverridePanel } from "@/components/headcount/override-panel";
import { HistoricalOrgHeadcountForeshadow } from "@/components/organization/historical-org-headcount-foreshadow";
import { assertPageAccess } from "@/lib/assert-page-access";

/**
 * Default headcount tab — existing approval / exemption / override UI (Story 4b.2).
 */
export default async function HeadcountCapacityPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }

  assertPageAccess(session.user.coarseRole, "/headcount");

  return (
    <div className="space-y-10 px-content-padding-inline py-4">
      <HeadcountApprovalPanel />
      <HeadcountExemptionPanel />
      <HeadcountOverridePanel />
      <HistoricalOrgHeadcountForeshadow />
    </div>
  );
}
