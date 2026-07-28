import { redirect } from "next/navigation";

import { CorrectionCasesPanel } from "@/components/correction-cases/correction-cases-panel";
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

  return <CorrectionCasesPanel />;
}
