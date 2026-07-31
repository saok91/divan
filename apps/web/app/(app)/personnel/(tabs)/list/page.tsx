import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { FullBleedTableHost } from "@/components/layout/panel-section";
import { PersonnelListPanel } from "@/components/personnel/personnel-list-panel";
import { assertPageAccess } from "@/lib/assert-page-access";

/**
 * Default personnel tab — governed list scaffold (Story 4b.7).
 * Layout ≠ RSC: assert before any client data load.
 */
export default async function PersonnelListPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }

  assertPageAccess(session.user.coarseRole, "/personnel");

  return (
    <FullBleedTableHost className="py-4">
      <PersonnelListPanel />
    </FullBleedTableHost>
  );
}
