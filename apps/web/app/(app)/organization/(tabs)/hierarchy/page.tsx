import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { OrgHierarchyPanel } from "@/components/organization/org-hierarchy-panel";
import { assertPageAccess } from "@/lib/assert-page-access";

/**
 * Default organization tab — hierarchy tree only (Story 4b.6).
 */
export default async function OrganizationHierarchyPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }

  assertPageAccess(session.user.coarseRole, "/organization");

  return (
    <div className="p-6">
      <OrgHierarchyPanel />
    </div>
  );
}
