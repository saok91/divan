import { redirect } from "next/navigation";

import { CorrectionCasesPanel } from "@/components/correction-cases/correction-cases-panel";
import { PageHeader } from "@/components/page-header";
import { auth } from "@/auth";
import { assertPageAccess } from "@/lib/assert-page-access";

/**
 * External data-subject correction cases (Story 7.5 / FR-53).
 * Layout≠RSC: assertPageAccess before load — coarse nav alone is insufficient
 * for tRPC; fine PermissionSet enforced on correctionCase.* via envelope.
 */
export default async function CorrectionCasesPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }
  assertPageAccess(session.user.coarseRole, "/correction-cases");

  return (
    <div className="bg-surface-page text-text-primary">
      <PageHeader
        id="correction-cases-heading"
        breadcrumb={
          <span>
            دیوان
            <span className="mx-1 text-text-tertiary" aria-hidden>
              /
            </span>
            پرونده‌های اصلاح
          </span>
        }
        title="پرونده‌های اصلاح"
        purpose="پیگیری درخواست‌های شفافیت و اصلاح دادهٔ موضوع خارجی برای تیم حاکمیت داده."
      />
      <div className="px-content-padding-inline pb-6">
        <CorrectionCasesPanel />
      </div>
    </div>
  );
}
