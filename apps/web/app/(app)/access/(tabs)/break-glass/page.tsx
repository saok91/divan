import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AccessBreakGlassPanel } from "@/components/access/access-break-glass-panel";
import { assertPageAccess } from "@/lib/assert-page-access";

export default async function AccessBreakGlassPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }

  assertPageAccess(session.user.coarseRole, "/access");

  return (
    <div className="px-content-padding-inline py-4">
      <AccessBreakGlassPanel currentAccountId={session.user.accountId} />
    </div>
  );
}
