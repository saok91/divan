import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { assertPageAccess } from "@/lib/assert-page-access";
import { getSessionContext } from "@divan/identity-access";
import { isPersonUuid, PersonIdentityError } from "@divan/person-employment";

import { assertPersonInScopedPopulation } from "~/server/personnel-scoped-search";

type PersonnelProfilePageProps = {
  params: Promise<{ personId: string }>;
};

/**
 * Thin profile placeholder (Story 5.1 deep-link).
 * Full profile sections = Story 5.2.
 * Population scope gate mirrors getById IDOR (AC #8).
 */
export default async function PersonnelProfilePlaceholderPage({
  params,
}: PersonnelProfilePageProps) {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }

  assertPageAccess(session.user.coarseRole, "/personnel");

  const { personId } = await params;
  if (!isPersonUuid(personId)) {
    redirect("/personnel/list");
  }

  const fresh = await getSessionContext(session.user.accountId);
  if (!fresh) {
    redirect("/login");
  }

  try {
    await assertPersonInScopedPopulation({
      personId,
      actorAccountId: fresh.accountId,
      actorScopeCodes: fresh.organizationalScopeCodes,
      correlationId: randomUUID(),
    });
  } catch (err) {
    if (
      err instanceof PersonIdentityError &&
      err.code === "PERSON_NOT_FOUND"
    ) {
      redirect("/personnel/list");
    }
    throw err;
  }

  return (
    <div className="space-y-4 p-6">
      <header className="space-y-1">
        <h1 className="text-title">پروفایل پرسنل</h1>
        <p className="text-body text-muted-foreground">
          بخش‌های کامل پروفایل در داستان ۵.۲ پیاده‌سازی می‌شود.
        </p>
      </header>
      <p className="text-body">
        شناسه:{" "}
        <span className="text-tabular" dir="ltr">
          {personId}
        </span>
      </p>
      <p>
        <a
          href="/personnel/list"
          className="text-body text-accent underline-offset-4 hover:underline"
        >
          بازگشت به فهرست پرسنل
        </a>
      </p>
    </div>
  );
}
