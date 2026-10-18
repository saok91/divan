"use client";

import { collaborationTypeLabel } from "@/lib/collaboration-type";
import * as React from "react";
import Link from "next/link";

import { PersonProfileSensitivityIcon } from "@/components/personnel/person-profile-sensitivity-icon";
import { CorrectionRequestCta } from "@/components/personnel/correction-request-cta";
import { PersonnelEventTimeline } from "@/components/personnel/personnel-event-timeline";
import { RecalcPendingMark } from "@/components/personnel/recalc-pending-mark";
import { StatusBadge } from "@/components/personnel/status-badge";
import { useLeaveGuardOptional } from "@/components/leave-guard";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "next-auth/react";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import { formatJalaliDisplayFromGregorian } from "@/lib/jalali";
import { eventTypeLabelFa } from "@/lib/personnel-event-timeline";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import {
  dictionaryFieldMeta,
  displayNameFromIdentityRows,
  labelLookup,
  presentIdentityFieldRows,
  stateHasCompensationCategory,
  type ProfileDictionaryElement,
  type ProfileOrgJobLabels,
} from "@/lib/person-profile-mapper";

const VIEW_SEMANTICS_LABEL_FA: Record<
  "current" | "historical" | "planned",
  string
> = {
  current: "جاری",
  historical: "تاریخی",
  planned: "برنامه‌ریزی‌شده",
};

const PROFILE_LOAD_ERROR_FA = "بارگذاری پروفایل ممکن نشد. دوباره تلاش کنید.";
const collaborationLabel = collaborationTypeLabel;

type PersonProfileViewProps = {
  personId: string;
  /** When set, timeline scrolls/highlights this event (`?event=`). */
  focusEventId?: string;
};

function ProfileSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <h2 className="text-title-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function FieldRow({
  label,
  value,
  sensitivity,
  dir,
}: {
  label: string;
  value: string;
  sensitivity?: string | null;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-body">
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        {label}
        <PersonProfileSensitivityIcon sensitivity={sensitivity} />
        <span aria-hidden="true">:</span>
      </span>
      <span dir={dir}>{value}</span>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="در حال بارگذاری پروفایل"
      data-slot="profile-skeleton"
    >
      <Skeleton className="h-8 w-48" />
      <div className="space-y-3 rounded-md border border-hairline p-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="space-y-3 rounded-md border border-hairline p-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="space-y-3 rounded-md border border-hairline p-4">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}

function dash(value: string | null | undefined): string {
  const t = value?.trim();
  return t ? t : "—";
}

function profileErrorMessage(message: string | undefined): string {
  const t = message?.trim();
  if (!t) return PROFILE_LOAD_ERROR_FA;
  // Prefer domain Persian messages; avoid leaking raw English/internal codes.
  if (/[\u0600-\u06FF]/.test(t)) return t;
  return PROFILE_LOAD_ERROR_FA;
}

/**
 * Permission-filtered Person profile host (Story 5.2 / FR-34 / UX-DR8; Story 9.7 CTA).
 * Consumes getCurrentPersonState + prior employments — no parallel SoT.
 */
export function PersonProfileView({
  personId,
  focusEventId,
}: PersonProfileViewProps) {
  const leaveGuard = useLeaveGuardOptional();
  const { data: session, status: sessionStatus } = useSession();
  // Client-safe role gate — do not import @divan/identity-access (pulls pg into browser).
  // Both /access and dictionary lifecycle are hr_admin-only in ROLE_NAV_HREFS / page gate.
  const isHrAdmin =
    sessionStatus === "authenticated" &&
    session?.user?.coarseRole === "hr_admin";
  const stateQuery = api.person.getCurrentState.useQuery({ personId });
  const fieldsQuery = api.person.listEnabledFields.useQuery();
  const dictQuery = api.person.listDictionary.useQuery();
  const priorQuery = api.person.listPriorEmployments.useQuery({ personId });
  const labelsQuery = api.person.getProfileLabels.useQuery({ personId });

  const coldLoad =
    stateQuery.isLoading ||
    fieldsQuery.isLoading ||
    dictQuery.isLoading ||
    priorQuery.isLoading ||
    labelsQuery.isLoading;

  if (coldLoad) {
    return <ProfileSkeleton />;
  }

  if (stateQuery.isError) {
    return (
      <FeedbackMessage kind="error">
        {profileErrorMessage(stateQuery.error.message)}
      </FeedbackMessage>
    );
  }

  if (fieldsQuery.isError) {
    return (
      <FeedbackMessage kind="error">
        {profileErrorMessage(fieldsQuery.error.message)}
      </FeedbackMessage>
    );
  }

  if (labelsQuery.isError) {
    return (
      <FeedbackMessage kind="error">
        {profileErrorMessage(labelsQuery.error.message)}
      </FeedbackMessage>
    );
  }

  if (dictQuery.isError) {
    return (
      <FeedbackMessage kind="error">
        {profileErrorMessage(dictQuery.error.message)}
      </FeedbackMessage>
    );
  }

  const state = stateQuery.data;
  if (!state) {
    return (
      <FeedbackMessage kind="error">
        بارگذاری وضعیت فرد ممکن نشد.
      </FeedbackMessage>
    );
  }

  if (state.ok === false) {
    const isRecalcBlock =
      state.code === "RECALCULATION_PENDING" ||
      state.code === "RECALCULATION_FAILED" ||
      state.code === "RECALCULATION_STALE";
    return (
      <div className="space-y-4">
        {isRecalcBlock ? (
          <div className="flex flex-wrap items-center gap-2">
            <RecalcPendingMark />
            <p role="alert" className="text-body text-text-tertiary">
              {state.messageFa}
            </p>
          </div>
        ) : (
          <p role="alert" className="text-body text-destructive">
            {state.messageFa}
          </p>
        )}
        <div className="pointer-events-none opacity-50" aria-disabled="true">
          <ProfileSkeleton />
        </div>
      </div>
    );
  }

  const labels: ProfileOrgJobLabels = labelsQuery.data!;
  const enabledFields = fieldsQuery.data ?? [];
  const dictionaryElements: ProfileDictionaryElement[] = (
    dictQuery.data ?? []
  ).map((row) => ({
    elementId: row.elementId,
    disposition: row.disposition,
    enabled: row.enabled,
    labelFa: row.labelFa,
    sensitivity: row.sensitivity ?? null,
  }));

  const identityRows = presentIdentityFieldRows(state.person, enabledFields);
  const displayName = displayNameFromIdentityRows(identityRows);

  const teamId =
    state.teamMembership?.teamId ?? state.primaryAssignment?.teamId ?? null;
  const primary = state.primaryAssignment;
  const hasCompensation = stateHasCompensationCategory(state);

  const amountMeta = dictionaryFieldMeta(
    dictionaryElements,
    "compensation.amount",
    "مبلغ",
  );
  const currencyMeta = dictionaryFieldMeta(
    dictionaryElements,
    "compensation.currency",
    "ارز",
  );
  const contractingMeta = dictionaryFieldMeta(
    dictionaryElements,
    "contract.contracting_entity",
    "طرف قرارداد",
  );
  const contractEndMeta = dictionaryFieldMeta(
    dictionaryElements,
    "contract.dates",
    "پایان قرارداد",
  );
  const contractCollabMeta = dictionaryFieldMeta(
    dictionaryElements,
    "contract.collaboration_type",
    "نوع همکاری قراردادی",
  );

  const canOpenAccess = isHrAdmin;
  const canOpenLifecycle = isHrAdmin;

  function navigateGuarded(href: string) {
    if (leaveGuard) {
      void leaveGuard.requestNavigation(href);
      return;
    }
    window.location.assign(href);
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            {displayName ? (
              <p className="text-heading-sm text-text-secondary">{displayName}</p>
            ) : null}
            <p className="flex flex-wrap items-center gap-2 text-body">
              <span className="text-text-secondary">نوع نما:</span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                  state.viewSemantics === "planned"
                    ? "status-badge-scheduled"
                    : state.viewSemantics === "historical"
                      ? "bg-muted text-muted-foreground"
                      : "status-badge-effective",
                )}
              >
                {VIEW_SEMANTICS_LABEL_FA[state.viewSemantics]}
              </span>
              <span className="text-muted-foreground" dir="ltr">
                {formatJalaliDisplayFromGregorian(state.asOf)}
              </span>
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
            <CorrectionRequestCta personId={personId} />
            {canOpenAccess ? (
              <div className="flex flex-col items-stretch gap-1 sm:items-end">
                <Button
                  type="button"
                  variant="tertiary"
                  size="sm"
                  onClick={() => navigateGuarded("/access/people")}
                >
                  {operationalCopy.profileAccessManageCta}
                </Button>
                <p className="max-w-xs text-caption text-text-tertiary sm:text-end">
                  {operationalCopy.profileAccessManageHint}
                </p>
              </div>
            ) : null}
            {canOpenLifecycle ? (
              <div className="flex flex-col items-stretch gap-1 sm:items-end">
                <Button
                  type="button"
                  variant="tertiary"
                  size="sm"
                  onClick={() => navigateGuarded("/personnel/dictionary")}
                >
                  {operationalCopy.profileLifecycleManageCta}
                </Button>
                <p className="max-w-xs text-caption text-text-tertiary sm:text-end">
                  {operationalCopy.profileLifecycleManageHint}
                </p>
              </div>
            ) : null}
          </div>
        </div>
        {state.baselineDisclosure.limited ||
        !state.baselineDisclosure.configured ? (
          <FeedbackMessage kind="info">
            {state.baselineDisclosure.messageFa}
          </FeedbackMessage>
        ) : null}
        {state.disposalDisclosure.limited &&
        state.disposalDisclosure.messageFa ? (
          <FeedbackMessage kind="info">
            {state.disposalDisclosure.messageFa}
          </FeedbackMessage>
        ) : null}
      </header>

      <ProfileSection title="هویت">
        {identityRows.length === 0 ? (
          <p className="text-body text-muted-foreground">
            فیلد هویتی برای نمایش وجود ندارد.
          </p>
        ) : (
          <div className="space-y-2">
            {identityRows.map((row) => (
              <FieldRow
                key={row.personFieldKey}
                label={row.labelFa}
                value={
                  row.personFieldKey === "birthDate" ? formatJalaliDisplayFromGregorian(row.value) :
                  row.personFieldKey === "personnelCode" ||
                  row.personFieldKey === "mobilePhone" ||
                  row.personFieldKey === "nationalId"
                    ? toPersianDigits(row.value)
                    : row.value
                }
                sensitivity={row.sensitivity}
                dir={
                  row.personFieldKey === "personnelCode" ||
                  row.personFieldKey === "mobilePhone" ||
                  row.personFieldKey === "nationalId" ||
                  row.personFieldKey === "birthDate"
                    ? "ltr"
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </ProfileSection>

      <ProfileSection title="اشتغال جاری">
        {state.employment ? (
          <div className="space-y-2">
            <FieldRow
              label="تاریخ شروع"
              value={formatJalaliDisplayFromGregorian(state.employment.startDate)}
              dir="ltr"
            />
            {state.employment.collaborationType ? (
              <FieldRow
                label="نوع همکاری"
                value={collaborationLabel(state.employment.collaborationType)}
              />
            ) : null}
            {teamId ? (
              <FieldRow
                label="تیم"
                value={dash(labelLookup(labels.teamNameById, teamId))}
              />
            ) : null}
          </div>
        ) : (
          <p className="text-body text-muted-foreground">
            اشتغال فعالی در تاریخ مبنا ثبت نشده است.
          </p>
        )}
      </ProfileSection>

      <ProfileSection title="انتصابات جاری">
        {primary ? (
          <div className="space-y-3 rounded-md border border-border p-3">
            <p className="text-label font-medium">اصلی</p>
            <div className="space-y-2">
              <FieldRow
                label="نقش سازمانی"
                value={dash(
                  labelLookup(
                    labels.roleNameById,
                    primary.organizationalRoleId,
                  ),
                )}
              />
              <FieldRow
                label="عنوان شغلی"
                value={dash(
                  labelLookup(labels.jobTitleNameById, primary.jobTitleId),
                )}
              />
              <FieldRow
                label="نردبان"
                value={dash(labelLookup(labels.ladderNameById, primary.ladderId))}
              />
              <FieldRow
                label="درجه"
                value={dash(labelLookup(labels.gradeNameById, primary.gradeId))}
              />
              <FieldRow
                label="تاریخ شروع"
                value={formatJalaliDisplayFromGregorian(primary.startDate)}
                dir="ltr"
              />
            </div>
          </div>
        ) : (
          <p className="text-body text-muted-foreground">
            انتصاب اصلی فعالی ثبت نشده است.
          </p>
        )}
        {state.secondaryAssignments.length > 0 ? (
          <ul className="space-y-3" aria-label="انتصابات فرعی">
            {state.secondaryAssignments.map((sec) => (
              <li
                key={sec.id}
                className="space-y-2 rounded-md border border-dashed border-border p-3"
              >
                <p className="text-label font-medium">فرعی</p>
                <FieldRow
                  label="واحد سازمانی"
                  value={dash(
                    labelLookup(labels.orgUnitNameById, sec.orgUnitId),
                  )}
                />
                <FieldRow label="دلیل" value={sec.reasonType} />
                {sec.organizationalRoleId ? (
                  <FieldRow
                    label="نقش سازمانی"
                    value={dash(
                      labelLookup(
                        labels.roleNameById,
                        sec.organizationalRoleId,
                      ),
                    )}
                  />
                ) : null}
                {sec.jobTitleId ? (
                  <FieldRow
                    label="عنوان شغلی"
                    value={dash(
                      labelLookup(labels.jobTitleNameById, sec.jobTitleId),
                    )}
                  />
                ) : null}
                {sec.ladderId ? (
                  <FieldRow
                    label="نردبان"
                    value={dash(
                      labelLookup(labels.ladderNameById, sec.ladderId),
                    )}
                  />
                ) : null}
                {sec.gradeId ? (
                  <FieldRow
                    label="درجه"
                    value={dash(labelLookup(labels.gradeNameById, sec.gradeId))}
                  />
                ) : null}
                <FieldRow
                  label="تاریخ شروع"
                  value={formatJalaliDisplayFromGregorian(sec.startDate)}
                  dir="ltr"
                />
              </li>
            ))}
          </ul>
        ) : null}
      </ProfileSection>

      {hasCompensation ? (
        <ProfileSection title="جبران خدمات و قرارداد">
          <div className="space-y-2">
            {state.compensation &&
            Object.hasOwn(state.compensation, "amount") &&
            state.compensation.amount != null &&
            String(state.compensation.amount).trim() !== "" ? (
              <FieldRow
                label={amountMeta.labelFa}
                value={toPersianDigits(String(state.compensation.amount))}
                sensitivity={amountMeta.sensitivity}
                dir="ltr"
              />
            ) : null}
            {state.compensation &&
            Object.hasOwn(state.compensation, "currency") &&
            state.compensation.currency ? (
              <FieldRow
                label={currencyMeta.labelFa}
                value={state.compensation.currency}
                sensitivity={currencyMeta.sensitivity}
              />
            ) : null}
            {state.contractual &&
            Object.hasOwn(state.contractual, "contractingEntity") &&
            state.contractual.contractingEntity ? (
              <FieldRow
                label={contractingMeta.labelFa}
                value={state.contractual.contractingEntity}
                sensitivity={contractingMeta.sensitivity}
              />
            ) : null}
            {state.contractual &&
            Object.hasOwn(state.contractual, "contractEndDateExclusive") &&
            state.contractual.contractEndDateExclusive ? (
              <FieldRow
                label={contractEndMeta.labelFa}
                value={formatJalaliDisplayFromGregorian(
                  state.contractual.contractEndDateExclusive,
                )}
                sensitivity={contractEndMeta.sensitivity}
                dir="ltr"
              />
            ) : null}
            {state.contractual &&
            Object.hasOwn(state.contractual, "collaborationType") &&
            state.contractual.collaborationType ? (
              <FieldRow
                label={contractCollabMeta.labelFa}
                value={collaborationLabel(state.contractual.collaborationType)}
                sensitivity={contractCollabMeta.sensitivity}
              />
            ) : null}
          </div>
        </ProfileSection>
      ) : null}

      <ProfileSection title="تغییرات زمان‌بندی‌شده">
        {state.scheduledChanges.length > 0 ? (
          <ul className="space-y-2" aria-label="تغییرات زمان‌بندی‌شده آینده">
            {state.scheduledChanges.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-2 text-body"
              >
                <StatusBadge status="Scheduled" />
                <span className="text-body">
                  {eventTypeLabelFa(row.eventType)}
                </span>
                <span className="text-muted-foreground" dir="ltr">
                  {formatJalaliDisplayFromGregorian(row.effectiveDate)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-muted-foreground">
            تغییر زمان‌بندی‌شده‌ای برای آینده ثبت نشده است.
          </p>
        )}
      </ProfileSection>

      <ProfileSection title="اشتغال‌های قبلی">
        {priorQuery.isError ? (
          <p role="alert" className="text-body text-destructive">
            {profileErrorMessage(priorQuery.error.message)}
          </p>
        ) : (priorQuery.data?.length ?? 0) === 0 ? (
          <p className="text-body text-muted-foreground">
            اشتغال قبلی ثبت نشده است.
          </p>
        ) : (
          <ul className="space-y-3">
            {priorQuery.data!.map((row) => (
              <li key={row.id} className="space-y-1 text-body">
                <FieldRow
                  label="بازه"
                  value={`${formatJalaliDisplayFromGregorian(row.startDate)} — ${formatJalaliDisplayFromGregorian(row.endDateExclusive)}`}
                  dir="ltr"
                />
                {row.collaborationType ? (
                  <FieldRow label="نوع همکاری" value={collaborationLabel(row.collaborationType)} />
                ) : null}
                {row.terminationReason ? (
                  <FieldRow label="دلیل خاتمه" value={row.terminationReason} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </ProfileSection>

      <ProfileSection title="گاه‌شمار رویدادهای پرسنلی" className="border-t border-border pt-6">
        <div id="personnel-timeline-entry" className="space-y-2">
          <PersonnelEventTimeline
            personId={personId}
            focusEventId={focusEventId}
            showCorrectionCta={false}
          />
        </div>
      </ProfileSection>

      <p>
        <Link
          href="/personnel/list"
          className="text-body text-accent underline-offset-4 hover:underline"
        >
          بازگشت به فهرست اطلاعات پرسنلی
        </Link>
      </p>
    </div>
  );
}
