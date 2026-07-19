import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SectionTabPlaceholder } from "@/components/section-tab-placeholder";
import { assertPageAccess } from "@/lib/assert-page-access";

export default async function HeadcountCreatePage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }
  assertPageAccess(session.user.coarseRole, "/headcount");
  return <SectionTabPlaceholder />;
}
