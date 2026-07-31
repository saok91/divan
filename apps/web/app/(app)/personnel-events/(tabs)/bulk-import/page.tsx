import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { BulkImportCatalogueHost } from "@/components/import/bulk-import-catalogue-host";
import { PageHeader } from "@/components/page-header";
import { assertPageAccess } from "@/lib/assert-page-access";
import { operationalCopy } from "@/lib/operational-copy";

/**
 * ورود گروهی (رویدادها) — catalogue/sample substrate (Story 9.1).
 * Full five-step bulk flow arrives in Story 9.2.
 */
export default async function PersonnelEventsBulkImportPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }
  assertPageAccess(session.user.coarseRole, "/personnel-events");

  return (
    <div className="space-y-4">
      <PageHeader
        title="ورود گروهی"
        purpose={operationalCopy.importBulkCatalogueHint}
      />
      <div className="px-content-padding-inline pb-6">
        <BulkImportCatalogueHost />
      </div>
    </div>
  );
}
