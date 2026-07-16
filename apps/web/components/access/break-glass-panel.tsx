"use client";

import { useId, useMemo, useState } from "react";

import { JalaliDateTimePicker } from "@/components/jalali-date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatJalaliDateTimeFromIso,
  gregorianDateTimePartsToIso,
  type GregorianDateTimeParts,
} from "@/lib/jalali";
import { operationalCopy } from "@/lib/operational-copy";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

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

/**
 * Break-glass request + post-use review queue (Story 2.5).
 * Client uses tRPC only — never imports @divan/identity-access.
 */
export function BreakGlassPanel({
  currentAccountId,
}: {
  currentAccountId?: string;
}) {
  const utils = api.useUtils();
  const [subjectAccountId, setSubjectAccountId] = useState("");
  const [incidentId, setIncidentId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [expiresAt, setExpiresAt] = useState<GregorianDateTimeParts>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const subjectId = useId();
  const incidentFieldId = useId();
  const purposeId = useId();
  const expiresId = useId();

  const entitlementsQuery = api.accessAdmin.listEntitlements.useQuery();
  const breakGlassQuery = api.accessAdmin.listBreakGlassGrants.useQuery();

  const invalidate = async () => {
    await utils.accessAdmin.listBreakGlassGrants.invalidate();
    await utils.accessAdmin.listGrants.invalidate();
    await utils.accessAdmin.listEntitlements.invalidate();
    await utils.me.invalidate();
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

  const requestBreakGlass = api.accessAdmin.requestBreakGlassGrant.useMutation({
    onSuccess: async () => {
      setStatusNote(operationalCopy.breakGlassRequested);
      setActionError(null);
      await invalidate();
    },
  });
  const approveGrant = api.accessAdmin.approveGrant.useMutation({
    onSuccess: async () => {
      setStatusNote(operationalCopy.grantApproved);
      await invalidate();
    },
  });
  const activateGrant = api.accessAdmin.activateGrant.useMutation({
    onSuccess: async () => {
      setStatusNote(operationalCopy.grantActivated);
      await invalidate();
    },
  });
  const revokeGrant = api.accessAdmin.revokeGrant.useMutation({
    onSuccess: async () => {
      setStatusNote(operationalCopy.grantRevoked);
      await invalidate();
    },
  });
  const waiveGrant = api.accessAdmin.waiveGrant.useMutation({
    onSuccess: async () => {
      setStatusNote(operationalCopy.grantWaived);
      await invalidate();
    },
  });
  const completeReview =
    api.accessAdmin.completeBreakGlassPostUseReview.useMutation({
      onSuccess: async () => {
        setStatusNote(operationalCopy.breakGlassReviewComplete);
        await invalidate();
      },
    });

  const pending = useMemo(
    () =>
      (breakGlassQuery.data ?? []).filter(
        (g) => g.status === "requested" || g.status === "approved",
      ),
    [breakGlassQuery.data],
  );

  const reviewQueue = useMemo(
    () =>
      (breakGlassQuery.data ?? []).filter(
        (g) =>
          g.postUseReviewStatus === "pending" &&
          (g.status === "active" ||
            g.status === "expired" ||
            g.status === "revoked" ||
            g.status === "suspended") &&
          g.subjectAccountId !== currentAccountId &&
          g.requesterAccountId !== currentAccountId &&
          g.approverAccountId !== currentAccountId,
      ),
    [breakGlassQuery.data, currentAccountId],
  );

  const busy =
    requestBreakGlass.isPending ||
    approveGrant.isPending ||
    activateGrant.isPending ||
    revokeGrant.isPending ||
    waiveGrant.isPending ||
    completeReview.isPending;

  return (
    <div className="flex flex-col gap-6">
      {actionError ? (
        <StatusMessage kind="error">{actionError}</StatusMessage>
      ) : null}
      {statusNote ? (
        <StatusMessage kind="info">{statusNote}</StatusMessage>
      ) : null}

      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setActionError(null);
          const expiresIso = gregorianDateTimePartsToIso(expiresAt);
          if (
            !subjectAccountId.trim() ||
            !incidentId.trim() ||
            !purpose.trim() ||
            !expiresIso
          ) {
            setActionError(operationalCopy.grantSubjectRequired);
            return;
          }
          const expires = new Date(expiresIso);
          if (Number.isNaN(expires.getTime()) || expires <= new Date()) {
            setActionError(operationalCopy.breakGlassExpiryInvalid);
            return;
          }
          requestBreakGlass.mutate(
            {
              subjectAccountId: subjectAccountId.trim(),
              incidentId: incidentId.trim(),
              purpose: purpose.trim(),
              expiresAt: expiresIso,
            },
            { onError: captureError },
          );
        }}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor={subjectId} className="text-label-medium">
            حساب موضوع
          </label>
          <select
            id={subjectId}
            className="h-10 rounded-md border border-input bg-background px-3 text-body-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={subjectAccountId}
            onChange={(e) => setSubjectAccountId(e.target.value)}
            disabled={busy}
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
          <label htmlFor={incidentFieldId} className="text-label-medium">
            {operationalCopy.breakGlassIncidentLabel}
          </label>
          <Input
            id={incidentFieldId}
            value={incidentId}
            onChange={(e) => setIncidentId(e.target.value)}
            disabled={busy}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor={purposeId} className="text-label-medium">
            {operationalCopy.breakGlassPurposeLabel}
          </label>
          <Input
            id={purposeId}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            disabled={busy}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-label-medium" id={`${expiresId}-label`}>
            {operationalCopy.breakGlassExpiresLabel}
          </span>
          <JalaliDateTimePicker
            id={expiresId}
            aria-label={operationalCopy.breakGlassExpiresLabel}
            value={expiresAt}
            onChange={setExpiresAt}
            disabled={busy}
            helperText={operationalCopy.breakGlassExpiresHelper}
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={busy}>
            ثبت درخواست اضطراری
          </Button>
        </div>
      </form>

      <section className="flex flex-col gap-2" aria-labelledby="bg-pending">
        <h3 id="bg-pending" className="text-title-small text-foreground">
          در انتظار تأیید / فعال‌سازی
        </h3>
        {breakGlassQuery.isLoading ? (
          <StatusMessage kind="loading">{operationalCopy.grantListLoading}</StatusMessage>
        ) : breakGlassQuery.isError ? (
          <StatusMessage kind="error">
            {breakGlassQuery.error.message || operationalCopy.grantListError}
          </StatusMessage>
        ) : pending.length === 0 ? (
          <StatusMessage kind="empty">{operationalCopy.emptyGrants}</StatusMessage>
        ) : (
          <ul className="flex flex-col gap-2">
            {pending.map((g) => (
              <li
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-2"
              >
                <div className="text-body-medium">
                  <span className="font-medium">{g.incidentId}</span>
                  <span className="ms-2 text-muted-foreground">{g.purpose}</span>
                  <span className="ms-2 text-label-medium text-muted-foreground">
                    {g.status}
                  </span>
                  {g.expiresAt ? (
                    <span className="ms-2 text-label-medium text-muted-foreground">
                      انقضا: {formatJalaliDateTimeFromIso(g.expiresAt)}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {g.status === "requested" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy || g.requesterAccountId === currentAccountId}
                      onClick={() =>
                        approveGrant.mutate(
                          { grantId: g.id },
                          { onError: captureError },
                        )
                      }
                    >
                      تأیید
                    </Button>
                  ) : null}
                  {g.status === "approved" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        activateGrant.mutate(
                          { grantId: g.id },
                          { onError: captureError },
                        )
                      }
                    >
                      فعال‌سازی
                    </Button>
                  ) : null}
                  {g.status === "requested" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={
                        busy ||
                        g.requesterAccountId === currentAccountId ||
                        g.subjectAccountId === currentAccountId
                      }
                      onClick={() =>
                        waiveGrant.mutate(
                          { grantId: g.id },
                          { onError: captureError },
                        )
                      }
                    >
                      رد
                    </Button>
                  ) : null}
                  {g.status === "approved" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        revokeGrant.mutate(
                          {
                            grantId: g.id,
                            reason: "break_glass_operator_revoke",
                          },
                          { onError: captureError },
                        )
                      }
                    >
                      لغو
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="bg-review">
        <h3 id="bg-review" className="text-title-small text-foreground">
          {operationalCopy.breakGlassReviewQueue}
        </h3>
        {reviewQueue.length === 0 ? (
          <StatusMessage kind="empty">
            {operationalCopy.breakGlassReviewEmpty}
          </StatusMessage>
        ) : (
          <ul className="flex flex-col gap-2">
            {reviewQueue.map((g) => (
              <li
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-2"
              >
                <div className="text-body-medium">
                  <span className="font-medium">{g.incidentId}</span>
                  <span className="ms-2 text-muted-foreground">{g.status}</span>
                </div>
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    completeReview.mutate(
                      { grantId: g.id },
                      { onError: captureError },
                    )
                  }
                >
                  {operationalCopy.breakGlassReviewAction}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
