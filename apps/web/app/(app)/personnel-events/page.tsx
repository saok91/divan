import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PlaceholderPage } from "@/components/placeholder-page";
import { assertPageAccess } from "@/lib/assert-page-access";

export default async function PersonnelEventsPage() {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }
  assertPageAccess(session.user.coarseRole, "/personnel-events");

  return (
    <PlaceholderPage
      title="رویدادهای پرسنلی"
      description="محتوای رویدادهای پرسنلی در استوری ۴ب.۷ اضافه می‌شود."
    />
  );
}
