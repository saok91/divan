import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { JobReferencePanel } from "@/components/organization/job-reference-panel";
import { OrganizationPanel } from "@/components/organization/organization-panel";
import { assertPageAccess } from "@/lib/assert-page-access";

/**
 * ساختار سازمان (Stories 3.5–3.6 / FR-9 + FR-10).
 * Hierarchy + job reference master-data. Layout ≠ RSC — assert before panels.
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
      <JobReferencePanel />
    </div>
  );
}
