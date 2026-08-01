import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ReportWorkspace } from "@/components/reports/report-workspace";
import { assertPageAccess } from "@/lib/assert-page-access";

/**
 * Reports subject tab — personnel catalogue rail (Story 9.5 / UX-DR33).
 * Optional catch-all allows shareable `/reports/personnel/{reportKey}` URLs.
 */
export default async function ReportsPersonnelPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }
  assertPageAccess(session.user.coarseRole, "/reports");
  return <ReportWorkspace subject="personnel" />;
}
