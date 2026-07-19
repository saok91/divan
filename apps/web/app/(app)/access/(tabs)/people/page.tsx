import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AccessAdminPanel } from "@/components/access/access-admin-panel";
import { assertPageAccess } from "@/lib/assert-page-access";

/**
 * Default access tab — existing AccessAdminPanel (Story 4b.2; split in 4b.5).
 */
export default async function AccessPeoplePage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }

  assertPageAccess(session.user.coarseRole, "/access");

  return (
    <div className="p-6">
      <AccessAdminPanel currentAccountId={session.user.accountId} />
    </div>
  );
}
