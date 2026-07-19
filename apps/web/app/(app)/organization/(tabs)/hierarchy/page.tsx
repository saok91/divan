import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { JobReferencePanel } from "@/components/organization/job-reference-panel";
import { OrganizationPanel } from "@/components/organization/organization-panel";
import { assertPageAccess } from "@/lib/assert-page-access";

/**
 * Default organization tab — existing hierarchy + job reference (Story 4b.2).
 */
export default async function OrganizationHierarchyPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }

  assertPageAccess(session.user.coarseRole, "/organization");

  return (
    <div className="space-y-10 p-6">
      <OrganizationPanel />
      <JobReferencePanel />
    </div>
  );
}
