import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { OrgSeniorityPanel } from "@/components/organization/org-seniority-panel";
import { assertPageAccess } from "@/lib/assert-page-access";

export default async function OrganizationSeniorityPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }
  assertPageAccess(session.user.coarseRole, "/organization");
  return (
    <div className="px-content-padding-inline py-4">
      <OrgSeniorityPanel />
    </div>
  );
}
