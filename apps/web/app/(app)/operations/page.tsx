import { redirect } from "next/navigation";

import { EvaluationSnapshotHonestyLine } from "@/components/operations/evaluation-snapshot-honesty";
import { LaunchArtifactPanel } from "@/components/operations/launch-artifact-panel";
import { OperationsHealthPanel } from "@/components/operations/operations-health-panel";
import { PageHeader } from "@/components/page-header";
import { auth } from "@/auth";
import { assertPageAccess } from "@/lib/assert-page-access";
import { operationalCopy } from "@/lib/operational-copy";

/**
 * Operations health surface (Story 7.2 / FR-45 / UJ-5) +
 * Launch Artifact Register panel (Story 7.7 / FR-55) +
 * Evaluation snapshot honesty line (Story 7.8 / FR-56).
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
    <div className="bg-surface-page text-text-primary">
      <PageHeader
        breadcrumb={
          <span>
            دیوان
            <span className="mx-1 text-text-tertiary" aria-hidden>
              /
            </span>
            عملیات
          </span>
        }
        title="عملیات"
        purpose={operationalCopy.operationsSurfacePurpose}
      />
      <div className="space-y-10 px-content-padding-inline pb-6">
        <OperationsHealthPanel />
        <EvaluationSnapshotHonestyLine />
        <LaunchArtifactPanel />
      </div>
    </div>
  );
}
