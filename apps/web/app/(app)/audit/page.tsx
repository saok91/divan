import { redirect } from "next/navigation";

import { AuditInvestigationPanel } from "@/components/audit/audit-investigation-panel";
import { auth } from "@/auth";
import { assertPageAccess } from "@/lib/assert-page-access";

/**
 * Audit investigation surface (Story 7.1).
 * Layout≠RSC: assertPageAccess before load — coarse nav alone is insufficient
 * for tRPC; fine permission enforced on audit.search via envelope.
 */
export default async function AuditPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }
  assertPageAccess(session.user.coarseRole, "/audit");

  return <AuditInvestigationPanel />;
}
