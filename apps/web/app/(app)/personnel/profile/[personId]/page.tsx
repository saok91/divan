import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";

import { PersonProfileView } from "@/components/personnel/person-profile-view";
import { PageHeader } from "@/components/page-header";
import { auth } from "@/auth";
import { assertPageAccess } from "@/lib/assert-page-access";
import { profileHref } from "@/lib/personnel-profile-href";
import { getSessionContext } from "@divan/identity-access";
import {
  getPersonByPersonnelCode,
  isPersonUuid,
  PersonIdentityError,
} from "@divan/person-employment";

import { assertPersonInScopedPopulation } from "~/server/personnel-scoped-search";

type PersonnelProfilePageProps = {
  params: Promise<{ personId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

/** Event focus query must be a UUID — reject anything else. */
function safeEventQuery(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed || !isPersonUuid(trimmed)) return undefined;
  return trimmed;
}

function isNextRedirectError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    String((err as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

/**
 * Permission-filtered Person profile (Story 5.2 / FR-34; Story 9.7 code deep-link).
 * Canonical path is always `/personnel/profile/{uuid}`; personnel-code resolves then redirects.
 */
export default async function PersonnelProfilePage({
  params,
  searchParams,
}: PersonnelProfilePageProps) {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.coarseRole) {
    redirect("/login");
  }

  assertPageAccess(session.user.coarseRole, "/personnel");

  const { personId: rawParam } = await params;
  const query = await searchParams;
  const focusEventId = safeEventQuery(firstQueryValue(query.event));
  const personParam = rawParam.trim();

  const fresh = await getSessionContext(session.user.accountId);
  if (!fresh) {
    redirect("/login");
  }

  if (!isPersonUuid(personParam)) {
    // Personnel-code deep-link → resolve in-scope → canonical UUID redirect.
    try {
      const person = await getPersonByPersonnelCode(personParam);
      if (!person) {
        redirect("/personnel/list");
      }
      await assertPersonInScopedPopulation({
        personId: person.id,
        actorAccountId: fresh.accountId,
        actorScopeCodes: fresh.organizationalScopeCodes,
        correlationId: randomUUID(),
      });
      redirect(profileHref(person.id, { eventId: focusEventId }));
    } catch (err) {
      if (isNextRedirectError(err)) throw err;
      if (
        err instanceof PersonIdentityError &&
        err.code === "PERSON_NOT_FOUND"
      ) {
        redirect("/personnel/list");
      }
      throw err;
    }
  }

  const personUuid = personParam;

  try {
    await assertPersonInScopedPopulation({
      personId: personUuid,
      actorAccountId: fresh.accountId,
      actorScopeCodes: fresh.organizationalScopeCodes,
      correlationId: randomUUID(),
    });
  } catch (err) {
    if (isNextRedirectError(err)) throw err;
    if (
      err instanceof PersonIdentityError &&
      err.code === "PERSON_NOT_FOUND"
    ) {
      redirect("/personnel/list");
    }
    throw err;
  }

  return (
    <div className="bg-surface-page text-text-primary">
      <PageHeader
        breadcrumb={
          <span>
            دیوان
            <span className="mx-1 text-text-tertiary" aria-hidden>
              /
            </span>
            پرسنل
            <span className="mx-1 text-text-tertiary" aria-hidden>
              /
            </span>
            پروفایل
          </span>
        }
        title="پروفایل فرد"
        purpose="وضعیت جاری فرد در محدودهٔ دسترسی شما."
      />
      <div className="px-content-padding-inline py-4">
        <PersonProfileView
          personId={personUuid}
          focusEventId={focusEventId}
        />
      </div>
    </div>
  );
}
