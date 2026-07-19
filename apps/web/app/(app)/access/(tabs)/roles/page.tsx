import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AccessRolesPanel } from "@/components/access/access-roles-panel";
import { assertPageAccess } from "@/lib/assert-page-access";

export default async function AccessRolesPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }

  assertPageAccess(session.user.coarseRole, "/access");

  return (
    <div className="p-6">
      <AccessRolesPanel currentAccountId={session.user.accountId} />
    </div>
  );
}
