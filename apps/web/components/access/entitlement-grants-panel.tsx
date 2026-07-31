"use client";

import { useId, useMemo, useState } from "react";

import { JalaliDateTimePicker } from "@/components/jalali-date-picker";
import { useLeaveGuardRegistration } from "@/components/leave-guard";
import { Button } from "@/components/ui/button";
import { RowActionButton } from "@/components/ui/row-action-button";
import {
  formatJalaliDateTimeFromIso,
  gregorianDateTimePartsToIso,
  type GregorianDateTimeParts,
} from "@/lib/jalali";
import { operationalCopy } from "@/lib/operational-copy";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";

type GrantKind =
  | "sensitive"
  | "global"
  | "bulk"
  | "mass_assignment"
  | "standard"
  | "role_create"
  | "scope_create"
  | "break_glass";

type GrantStatus =
  | "requested"
  | "approved"
  | "active"
  | "expired"
  | "revoked"
  | "suspended"
  | "rejected";

const KIND_LABELS: Record<GrantKind, string> = {
  sensitive: "حساس",
  global: "سراسری",
  bulk: "بالک",
  mass_assignment: "تخصیص انبوه",
  standard: "استاندارد",
  role_create: "ایجاد نقش",
  scope_create: "ایجاد محدوده",
  break_glass: "اضطراری",
};

const STATUS_LABELS: Record<GrantStatus, string> = {
  requested: "درخواست‌شده",
  approved: "تأییدشده",
  active: "فعال",
  expired: "منقضی",
  revoked: "لغوشده",
  suspended: "معلق",
  rejected: "ردشده",
};

function StatusMessage({
  kind,
  children,
}: {
  kind: "loading" | "error" | "empty" | "info";
  children: React.ReactNode;
}) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
      className={cn(
        "text-body-medium",
        kind === "error" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {children}
    </p>
  );
}

export function EntitlementGrantsPanel({
  currentAccountId,
}: {
  currentAccountId?: string;
}) {
  const utils = api.useUtils();
  const [statusFilter, setStatusFilter] = useState<GrantStatus | "all">("all");
  const [kind, setKind] = useState<GrantKind>("sensitive");
  const [subjectAccountId, setSubjectAccountId] = useState("");
  const [accessRoleId, setAccessRoleId] = useState("");
  const [organizationalScopeId, setOrganizationalScopeId] = useState("");
  const [expiresAt, setExpiresAt] = useState<GregorianDateTimeParts>({});
  const [recertifyBy, setRecertifyBy] = useState<GregorianDateTimeParts>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const grantFormDirty =
    subjectAccountId.length > 0 ||
    accessRoleId.length > 0 ||
    organizationalScopeId.length > 0 ||
    Boolean(expiresAt.date || expiresAt.time) ||
    Boolean(recertifyBy.date || recertifyBy.time) ||
    kind !== "sensitive";

  useLeaveGuardRegistration({
    id: "access-entitlement-grants-request",
    isDirty: grantFormDirty,
    onDiscard: () => {
      setSubjectAccountId("");
      setAccessRoleId("");
      setOrganizationalScopeId("");
      setExpiresAt({});
      setRecertifyBy({});
      setKind("sensitive");
    },
  });

  const filterId = useId();
  const kindId = useId();
  const subjectId = useId();
  const roleId = useId();
  const scopeId = useId();
  const expiresId = useId();
  const recertId = useId();

  const grantsQuery = api.accessAdmin.listGrants.useQuery(
    statusFilter === "all" ? undefined : { status: statusFilter },
  );
  const entitlementsQuery = api.accessAdmin.listEntitlements.useQuery();
  const rolesQuery = api.accessAdmin.listRoles.useQuery();
  const scopesQuery = api.accessAdmin.listScopes.useQuery();

  const invalidateGrants = async () => {
    await utils.accessAdmin.listGrants.invalidate();
    await utils.accessAdmin.listEntitlements.invalidate();
    await utils.accessAdmin.listRoles.invalidate();
    await utils.accessAdmin.listScopes.invalidate();
  };

  function captureError(err: unknown) {
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : operationalCopy.grantActionFailed;
    if (message.includes("تغییر کرد") || message === operationalCopy.scopeRevoked) {
      setActionError(operationalCopy.scopeRevoked);
    } else {
      setActionError(message);
    }
  }

  const requestGrant = api.accessAdmin.requestGrant.useMutation({
    onSuccess: async () => {
      setStatusNote(operationalCopy.grantRequested);
      await invalidateGrants();
    },
  });
  const approveGrant = api.accessAdmin.approveGrant.useMutation({
    onSuccess: async () => {
      setStatusNote(operationalCopy.grantApproved);
      await invalidateGrants();
    },
  });
  const activateGrant = api.accessAdmin.activateGrant.useMutation({
    onSuccess: async () => {
      setStatusNote(operationalCopy.grantActivated);
      await invalidateGrants();
    },
  });
  const revokeGrant = api.accessAdmin.revokeGrant.useMutation({
    onSuccess: async () => {
      setStatusNote(operationalCopy.grantRevoked);
      await invalidateGrants();
    },
  });
  const waiveGrant = api.accessAdmin.waiveGrant.useMutation({
    onSuccess: async () => {
      setStatusNote(operationalCopy.grantWaived);
      await invalidateGrants();
    },
  });
  const recertifyGrant = api.accessAdmin.recertifyGrant.useMutation({
    onSuccess: async () => {
      setStatusNote(operationalCopy.grantRecertified);
      await invalidateGrants();
    },
  });

  const pending = useMemo(
    () =>
      (grantsQuery.data ?? []).filter(
        (g) => g.status === "requested" || g.status === "approved",
      ),
    [grantsQuery.data],
  );

  const overdueOrSuspended = useMemo(
    () => (grantsQuery.data ?? []).filter((g) => g.status === "suspended"),
    [grantsQuery.data],
  );

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-title-medium text-foreground">
          چرخهٔ entitlement
        </h2>
        <p className="text-body-medium text-muted-foreground">
          درخواست، تأیید مستقل، فعال‌سازی، انقضا، لغو و بازتأیید — بدون تأیید
          خود.
        </p>
      </header>

      {actionError ? (
        <StatusMessage kind="error">{actionError}</StatusMessage>
      ) : null}
      {statusNote ? (
        <StatusMessage kind="info">{statusNote}</StatusMessage>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex min-w-[10rem] flex-col gap-1">
          <label htmlFor={filterId} className="text-label-medium">
            فیلتر وضعیت
          </label>
          <select
            id={filterId}
            className="h-10 rounded-md border border-input bg-background px-3 text-body-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as GrantStatus | "all")
            }
          >
            <option value="all">همه</option>
            {(Object.keys(STATUS_LABELS) as GrantStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {grantsQuery.isLoading ? (
        <StatusMessage kind="loading">
          {operationalCopy.grantListLoading}
        </StatusMessage>
      ) : grantsQuery.isError ? (
        <StatusMessage kind="error">
          {grantsQuery.error.message || operationalCopy.grantListError}
        </StatusMessage>
      ) : !(grantsQuery.data?.length ?? 0) ? (
        <StatusMessage kind="empty">
          {operationalCopy.emptyGrants}
        </StatusMessage>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="فهرست درخواست‌های دسترسی">
          {grantsQuery.data!.map((g) => {
            const isSelfSubject = currentAccountId === g.subjectAccountId;
            const isSelfRequester = currentAccountId === g.requesterAccountId;
            const canApprove =
              g.status === "requested" && !isSelfSubject && !isSelfRequester;
            const canActivate =
              g.status === "approved" ||
              (g.status === "requested" && g.kind === "standard");
            const canRevoke =
              g.status === "active" ||
              g.status === "suspended" ||
              g.status === "approved";
            const canWaive =
              (g.status === "requested" || g.status === "approved") &&
              !isSelfSubject &&
              !isSelfRequester;
            const canRecert =
              (g.status === "active" || g.status === "suspended") &&
              !isSelfSubject;

            return (
              <li
                key={g.id}
                className="flex flex-col gap-2 border border-border p-3"
              >
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-body-medium">
                  <span>{KIND_LABELS[g.kind as GrantKind] ?? g.kind}</span>
                  <span>{STATUS_LABELS[g.status as GrantStatus] ?? g.status}</span>
                  <span className="text-muted-foreground">
                    موضوع: {g.subjectAccountId.slice(0, 8)}…
                  </span>
                  {g.expiresAt ? (
                    <span className="text-muted-foreground">
                      انقضا: {formatJalaliDateTimeFromIso(g.expiresAt)}
                    </span>
                  ) : null}
                  {g.recertifyBy ? (
                    <span className="text-muted-foreground">
                      بازتأیید تا: {formatJalaliDateTimeFromIso(g.recertifyBy)}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {canApprove ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={approveGrant.isPending}
                      onClick={() => {
                        setActionError(null);
                        setStatusNote(null);
                        approveGrant.mutate(
                          { grantId: g.id },
                          { onError: captureError },
                        );
                      }}
                    
            disabledReason={operationalCopy.actionPending}
          >
                      تأیید
                    </Button>
                  ) : null}
                  {canActivate ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={activateGrant.isPending}
                      onClick={() => {
                        setActionError(null);
                        setStatusNote(null);
                        activateGrant.mutate(
                          { grantId: g.id },
                          { onError: captureError },
                        );
                      }}
                    
            disabledReason={operationalCopy.actionPending}
          >
                      فعال‌سازی
                    </Button>
                  ) : null}
                  {canWaive ? (
                    <Button
                      type="button"
                      variant="tertiary"
                      disabled={waiveGrant.isPending}
                      onClick={() => {
                        setActionError(null);
                        setStatusNote(null);
                        waiveGrant.mutate(
                          { grantId: g.id },
                          { onError: captureError },
                        );
                      }}
                    
            disabledReason={operationalCopy.actionPending}
          >
                      رد
                    </Button>
                  ) : null}
                  {canRevoke ? (
                    <Button
                      type="button"
                      variant="tertiary"
                      disabled={revokeGrant.isPending}
                      onClick={() => {
                        setActionError(null);
                        setStatusNote(null);
                        revokeGrant.mutate(
                          { grantId: g.id, reason: "admin_revoke" },
                          { onError: captureError },
                        );
                      }}
                    
            disabledReason={operationalCopy.actionPending}
          >
                      لغو
                    </Button>
                  ) : null}
                  {canRecert ? (
                    <RowActionButton
                      label="بازتأیید"
                      icon={RefreshCw}
                      disabled={recertifyGrant.isPending}
                      disabledReason="در حال انجام عملیات…"
                      onClick={() => {
                        setActionError(null);
                        setStatusNote(null);
                        recertifyGrant.mutate(
                          { grantId: g.id },
                          { onError: captureError },
                        );
                      }}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {overdueOrSuspended.length > 0 ? (
        <StatusMessage kind="info">
          {operationalCopy.grantOverdueHint}
        </StatusMessage>
      ) : null}

      {pending.length > 0 ? (
        <StatusMessage kind="info">
          {pending.length} درخواست در انتظار تأیید یا فعال‌سازی.
        </StatusMessage>
      ) : null}

      <form
        className="flex flex-col gap-3 border-t border-border pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          setActionError(null);
          setStatusNote(null);
          if (!subjectAccountId) {
            setActionError(operationalCopy.grantSubjectRequired);
            return;
          }
          requestGrant.mutate(
            {
              subjectAccountId,
              kind,
              accessRoleId: accessRoleId || null,
              organizationalScopeId: organizationalScopeId || null,
              expiresAt: gregorianDateTimePartsToIso(expiresAt),
              recertifyBy: gregorianDateTimePartsToIso(recertifyBy),
            },
            { onError: captureError },
          );
        }}
      >
        <h3 className="text-title-small text-foreground">درخواست دسترسی</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={kindId} className="text-label-medium">
              نوع
            </label>
            <select
              id={kindId}
              className="h-10 rounded-md border border-input bg-background px-3 text-body-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={kind}
              onChange={(e) => setKind(e.target.value as GrantKind)}
            >
              {(Object.keys(KIND_LABELS) as GrantKind[])
                .filter(
                  (k) =>
                    k !== "role_create" &&
                    k !== "scope_create" &&
                    k !== "break_glass",
                )
                .map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={subjectId} className="text-label-medium">
              حساب موضوع
            </label>
            <select
              id={subjectId}
              className="h-10 rounded-md border border-input bg-background px-3 text-body-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={subjectAccountId}
              onChange={(e) => setSubjectAccountId(e.target.value)}
              required
            >
              <option value="">انتخاب کنید</option>
              {(entitlementsQuery.data ?? []).map((row) => (
                <option key={row.accountId} value={row.accountId}>
                  {row.displayName} ({row.username})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={roleId} className="text-label-medium">
              نقش (اختیاری)
            </label>
            <select
              id={roleId}
              className="h-10 rounded-md border border-input bg-background px-3 text-body-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={accessRoleId}
              onChange={(e) => setAccessRoleId(e.target.value)}
            >
              <option value="">—</option>
              {(rolesQuery.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.labelFa} ({r.code})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={scopeId} className="text-label-medium">
              محدوده (اختیاری)
            </label>
            <select
              id={scopeId}
              className="h-10 rounded-md border border-input bg-background px-3 text-body-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={organizationalScopeId}
              onChange={(e) => setOrganizationalScopeId(e.target.value)}
            >
              <option value="">—</option>
              {(scopesQuery.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.labelFa}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-label-medium">
              {operationalCopy.grantExpiresLabel}
            </span>
            <JalaliDateTimePicker
              id={expiresId}
              aria-label={operationalCopy.grantExpiresLabel}
              value={expiresAt}
              onChange={setExpiresAt}
              helperText={operationalCopy.grantExpiresHelper}
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-label-medium">
              {operationalCopy.grantRecertifyLabel}
            </span>
            <JalaliDateTimePicker
              id={recertId}
              aria-label={operationalCopy.grantRecertifyLabel}
              value={recertifyBy}
              onChange={setRecertifyBy}
              helperText={operationalCopy.grantRecertifyHelper}
            />
          </div>
        </div>
        <Button type="submit" disabled={requestGrant.isPending}
            disabledReason={operationalCopy.actionPending}
          >
          ثبت درخواست
        </Button>
      </form>
    </section>
  );
}
