import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PersonnelEventsListPanel } from "@/components/personnel/personnel-events-list-panel";
import { assertPageAccess } from "@/lib/assert-page-access";

/**
 * رویدادها tab — scaffold governed table (Story 4b.7). Full catalogue = Epic 5+.
 */
export default async function PersonnelEventsEventsPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }
  assertPageAccess(session.user.coarseRole, "/personnel-events");

  return (
    <div className="p-6">
      <PersonnelEventsListPanel />
    </div>
  );
}
