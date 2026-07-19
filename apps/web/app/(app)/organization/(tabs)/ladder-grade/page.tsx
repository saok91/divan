import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { OrgLadderGradePanel } from "@/components/organization/org-ladder-grade-panel";
import { assertPageAccess } from "@/lib/assert-page-access";

export default async function OrganizationLadderGradePage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }
  assertPageAccess(session.user.coarseRole, "/organization");
  return (
    <div className="p-6">
      <OrgLadderGradePanel />
    </div>
  );
}
