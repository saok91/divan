import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AccessAdminPanel } from "@/components/access/access-admin-panel";
import { assertPageAccess } from "@/lib/assert-page-access";

/**
 * Access administration surface (Story 2.3).
 * Layout path-gate is not enough — assert before any client data load (Layout ≠ RSC).
 * tRPC provider lives on `(app)/layout` for banner mid-session sync.
 */
export default async function AccessPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }

  // Must run before any entitlement loader / tRPC client fetch.
  assertPageAccess(session.user.coarseRole, "/access");

  return (
    <div className="p-6">
      <AccessAdminPanel currentAccountId={session.user.accountId} />
    </div>
  );
}
