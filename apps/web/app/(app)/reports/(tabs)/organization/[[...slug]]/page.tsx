import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ReportWorkspace } from "@/components/reports/report-workspace";
import { assertPageAccess } from "@/lib/assert-page-access";

export default async function ReportsOrganizationPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }
  assertPageAccess(session.user.coarseRole, "/reports");
  return <ReportWorkspace subject="organization" />;
}
