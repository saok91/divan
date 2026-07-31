import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { OrgJobTitlesPanel } from "@/components/organization/org-job-titles-panel";
import { assertPageAccess } from "@/lib/assert-page-access";

export default async function OrganizationJobTitlesPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }
  assertPageAccess(session.user.coarseRole, "/organization");
  return (
    <div className="px-content-padding-inline py-4">
      <OrgJobTitlesPanel />
    </div>
  );
}
