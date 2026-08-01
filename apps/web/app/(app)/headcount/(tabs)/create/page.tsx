import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { HeadcountApprovalCreateForm } from "@/components/headcount/headcount-approval-create-form";
import { assertPageAccess } from "@/lib/assert-page-access";

/**
 * Headcount create tab — full approval FormLayout form (Story 9.4).
 */
export default async function HeadcountCreatePage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }
  assertPageAccess(session.user.coarseRole, "/headcount");
  return <HeadcountApprovalCreateForm />;
}
