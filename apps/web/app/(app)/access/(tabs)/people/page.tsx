import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AccessPeoplePanel } from "@/components/access/access-people-panel";
import { assertPageAccess } from "@/lib/assert-page-access";

export default async function AccessPeoplePage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }

  assertPageAccess(session.user.coarseRole, "/access");

  return (
    <div className="p-6">
      <AccessPeoplePanel />
    </div>
  );
}
