import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { HeadcountApprovalPanel } from "@/components/headcount/approval-panel";
import { HistoricalOrgHeadcountForeshadow } from "@/components/organization/historical-org-headcount-foreshadow";
import { assertPageAccess } from "@/lib/assert-page-access";

/**
 * Headcount surface — Approval admin (4.12) + FR-27 foreshadow (4.11).
 */
export default async function HeadcountPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }

  assertPageAccess(session.user.coarseRole, "/headcount");

  return (
    <div className="space-y-10 p-6">
      <div className="space-y-2">
        <h1 className="text-heading">ظرفیت و جذب</h1>
        <p className="text-body text-muted-foreground">
          ظرفیت سازمانی و فرایند جذب در این بخش پیگیری می‌شود.
        </p>
      </div>
      <HeadcountApprovalPanel />
      <HistoricalOrgHeadcountForeshadow />
    </div>
  );
}
