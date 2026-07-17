import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { OrganizationPanel } from "@/components/organization/organization-panel";
import { assertPageAccess } from "@/lib/assert-page-access";

/**
 * ساختار سازمان (Story 3.5 / FR-9).
 * Layout path-gate is not enough — assert before any client data load (Layout ≠ RSC).
 */
export default async function OrganizationPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }

  assertPageAccess(session.user.coarseRole, "/organization");

  return (
    <div className="space-y-10 p-6">
      <OrganizationPanel />
    </div>
  );
}
