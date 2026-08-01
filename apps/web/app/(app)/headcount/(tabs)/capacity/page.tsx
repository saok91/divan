import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { HeadcountApprovalsTable } from "@/components/headcount/headcount-approvals-table";
import { assertPageAccess } from "@/lib/assert-page-access";

/**
 * Default headcount tab — one approvals GovernedDataTable (Story 9.4 / UX-DR34).
 */
export default async function HeadcountCapacityPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }

  assertPageAccess(session.user.coarseRole, "/headcount");

  return <HeadcountApprovalsTable />;
}
