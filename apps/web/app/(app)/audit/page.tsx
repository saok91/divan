import { redirect } from "next/navigation";

import { AuditInvestigationPanel } from "@/components/audit/audit-investigation-panel";
import { PageHeader } from "@/components/page-header";
import { auth } from "@/auth";
import { assertPageAccess } from "@/lib/assert-page-access";
import { operationalCopy } from "@/lib/operational-copy";

/**
 * Audit investigation surface (Story 7.1; Story 9.8 purpose clarity).
 * Layout≠RSC: assertPageAccess before load — coarse nav alone is insufficient
 * for tRPC; fine permission enforced on audit.search via envelope.
 */
export default async function AuditPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }
  assertPageAccess(session.user.coarseRole, "/audit");

  return (
    <div className="bg-surface-page text-text-primary">
      <PageHeader
        id="audit-investigation-heading"
        breadcrumb={
          <span>
            دیوان
            <span className="mx-1 text-text-tertiary" aria-hidden>
              /
            </span>
            ممیزی
          </span>
        }
        title="ممیزی"
        purpose={operationalCopy.auditSurfacePurpose}
      />
      <div className="px-content-padding-inline pb-6">
        <AuditInvestigationPanel />
      </div>
    </div>
  );
}
