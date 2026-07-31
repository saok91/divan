"use client";

import * as React from "react";

import {
  EntityPicker,
  EntityToken,
  TechnicalDetailDisclosure,
  createOrgUnitSearch,
  createPersonSearch,
  type EntityPickerValue,
} from "@/components/entity-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import { api } from "@/lib/trpc/client";

type ConfirmKind = "place" | "release" | "dispose" | null;

type ScopeKind = "person" | "element_category" | "artifact" | "org_scope";

function ScopeIdentity({
  scopeKind,
  scopeRef,
}: {
  scopeKind: string;
  scopeRef: string;
}) {
  const personQ = api.person.getById.useQuery(
    { id: scopeRef },
    { enabled: scopeKind === "person" && Boolean(scopeRef), retry: false },
  );
  const orgQ = api.organization.get.useQuery(
    { id: scopeRef },
    { enabled: scopeKind === "org_scope" && Boolean(scopeRef), retry: false },
  );

  if (scopeKind === "person" && personQ.data) {
    const code = personQ.data.personnelCode?.trim() || "";
    const name =
      `${personQ.data.givenName ?? ""} ${personQ.data.familyName ?? ""}`.trim() ||
      code ||
      "پرسنل";
    return (
      <span>
        person: {code ? `${toPersianDigits(code)} — ` : ""}
        {name}
      </span>
    );
  }
  if (scopeKind === "org_scope" && orgQ.data) {
    return (
      <span>
        org_scope: {orgQ.data.code} — {orgQ.data.nameFa}
      </span>
    );
  }
  if (scopeKind === "person" || scopeKind === "org_scope") {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span>{scopeKind}:</span>
        <TechnicalDetailDisclosure
          value={scopeRef}
          valueLabelFa="شناسهٔ فنی محدوده"
        />
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span>{scopeKind}:</span>
      <TechnicalDetailDisclosure
        value={scopeRef}
        valueLabelFa="شناسهٔ فنی محدوده"
      />
    </span>
  );
}

/**
 * Legal hold + disposal panel — preferred surface under dictionary Admin
 * (Story 7.3). No new top-level IA.
 */
export function PersonnelLifecyclePanel() {
  const formId = React.useId();
  const utils = api.useUtils();
  const holdsQuery = api.retention.listHolds.useQuery();
  const runsQuery = api.retention.listRuns.useQuery();

  const [scopeKind, setScopeKind] = React.useState<ScopeKind>("person");
  const [scopeEntity, setScopeEntity] = React.useState<EntityPickerValue>(null);
  const [scopeRefRaw, setScopeRefRaw] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [disposePersons, setDisposePersons] = React.useState<
    NonNullable<EntityPickerValue>[]
  >([]);
  const [disposeAdd, setDisposeAdd] = React.useState<EntityPickerValue>(null);
  const [releaseHoldId, setReleaseHoldId] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmKind>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const confirmTriggerRef = React.useRef<HTMLElement | null>(null);

  const personSearch = React.useMemo(() => createPersonSearch(), []);
  const orgUnitSearch = React.useMemo(() => createOrgUnitSearch(), []);

  const scopeRef =
    scopeKind === "person" || scopeKind === "org_scope"
      ? (scopeEntity?.id?.trim() ?? "")
      : scopeRefRaw.trim();

  const placeMutation = api.retention.placeHold.useMutation({
    onSuccess: async () => {
      setActionError(null);
      setReason("");
      setScopeEntity(null);
      setScopeRefRaw("");
      setConfirm(null);
      await utils.retention.listHolds.invalidate();
      restoreFocus();
    },
    onError: (err) => {
      setActionError(err.message || operationalCopy.lifecycleActionFailed);
      setConfirm(null);
      restoreFocus();
    },
  });

  const releaseMutation = api.retention.releaseHold.useMutation({
    onSuccess: async () => {
      setActionError(null);
      setReleaseHoldId(null);
      setConfirm(null);
      await utils.retention.listHolds.invalidate();
      restoreFocus();
    },
    onError: (err) => {
      setActionError(err.message || operationalCopy.lifecycleActionFailed);
      setConfirm(null);
      restoreFocus();
    },
  });

  const disposeMutation = api.retention.runDisposal.useMutation({
    onSuccess: async () => {
      setActionError(null);
      setReason("");
      setScopeEntity(null);
      setScopeRefRaw("");
      setDisposePersons([]);
      setDisposeAdd(null);
      setConfirm(null);
      await Promise.all([
        utils.retention.listRuns.invalidate(),
        utils.retention.listHolds.invalidate(),
      ]);
      restoreFocus();
    },
    onError: (err) => {
      setActionError(err.message || operationalCopy.lifecycleActionFailed);
      setConfirm(null);
      restoreFocus();
    },
  });

  function restoreFocus() {
    confirmTriggerRef.current?.focus();
  }

  function openConfirm(kind: ConfirmKind, trigger: HTMLElement) {
    confirmTriggerRef.current = trigger;
    setConfirm(kind);
  }

  const parsedDisposePersonIds = disposePersons.map((p) => p.id);

  const needsDisposeSubjects =
    scopeKind === "element_category" || scopeKind === "org_scope";
  const disposeReady =
    Boolean(scopeRef) &&
    Boolean(reason.trim()) &&
    (!needsDisposeSubjects || parsedDisposePersonIds.length > 0);

  const busy =
    placeMutation.isPending ||
    releaseMutation.isPending ||
    disposeMutation.isPending;

  const coldLoading = holdsQuery.isLoading || runsQuery.isLoading;
  const loadError =
    holdsQuery.isError || runsQuery.isError
      ? holdsQuery.error?.message ||
        runsQuery.error?.message ||
        operationalCopy.lifecycleLoadError
      : null;

  return (
    <section
      className="mx-auto max-w-3xl space-y-6 border-t border-border pt-8 text-foreground"
      aria-labelledby={`${formId}-lifecycle-heading`}
    >
      <header className="space-y-2">
        <h2 id={`${formId}-lifecycle-heading`} className="text-heading-sm">
          {operationalCopy.lifecycleHeading}
        </h2>
        <p className="text-caption text-muted-foreground">
          {operationalCopy.lifecycleIntro}
        </p>
        <p className="text-caption text-muted-foreground" role="note">
          {operationalCopy.lifecycleExportTtlNotRetention}
        </p>
      </header>

      {coldLoading ? (
        <div className="space-y-2" role="status" aria-live="polite">
          <span className="sr-only">{operationalCopy.lifecycleLoading}</span>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : null}

      {loadError ? (
        <p className="text-body text-destructive" role="alert">
          {loadError}
        </p>
      ) : null}

      {actionError ? (
        <p className="text-body text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      {!coldLoading && !loadError ? (
        <>
          <div className="space-y-3">
            <h3 className="text-body font-medium">
              {operationalCopy.lifecyclePlaceHold}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label
                className="block space-y-1.5 text-caption"
                htmlFor={`${formId}-scope-kind`}
              >
                {operationalCopy.lifecycleScopeKind}
                <select
                  id={`${formId}-scope-kind`}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={scopeKind}
                  onChange={(e) => {
                    setScopeKind(e.target.value as ScopeKind);
                    setScopeEntity(null);
                    setScopeRefRaw("");
                    setDisposePersons([]);
                    setDisposeAdd(null);
                  }}
                >
                  <option value="person">person</option>
                  <option value="artifact">artifact</option>
                  <option value="element_category">element_category</option>
                  <option value="org_scope">org_scope</option>
                </select>
              </label>
              <div className="block space-y-1.5 text-caption">
                <span id={`${formId}-scope-ref-label`}>
                  {scopeKind === "person"
                    ? "فرد"
                    : scopeKind === "org_scope"
                      ? "واحد سازمانی"
                      : operationalCopy.lifecycleScopeRef}
                </span>
                {scopeKind === "person" ? (
                  <EntityPicker
                    id={`${formId}-scope-ref`}
                    search={personSearch}
                    value={scopeEntity}
                    onValueChange={setScopeEntity}
                    scopeNoteFa="جستجو با کد پرسنلی یا نام"
                    placeholder="کد یا نام پرسنل…"
                    aria-labelledby={`${formId}-scope-ref-label`}
                  />
                ) : scopeKind === "org_scope" ? (
                  <EntityPicker
                    id={`${formId}-scope-ref`}
                    search={orgUnitSearch}
                    value={scopeEntity}
                    onValueChange={setScopeEntity}
                    scopeNoteFa="واحدهای سازمانی قابل‌مشاهده"
                    placeholder="کد یا نام واحد…"
                    aria-labelledby={`${formId}-scope-ref-label`}
                  />
                ) : (
                  <Input
                    id={`${formId}-scope-ref`}
                    value={scopeRefRaw}
                    onChange={(e) => setScopeRefRaw(e.target.value)}
                    dir="ltr"
                    autoComplete="off"
                    aria-labelledby={`${formId}-scope-ref-label`}
                    placeholder={
                      scopeKind === "artifact"
                        ? "شناسهٔ فنی خروجی"
                        : "مرجع دستهٔ عنصر"
                    }
                  />
                )}
              </div>
              <label
                className="block space-y-1.5 text-caption sm:col-span-2"
                htmlFor={`${formId}-reason`}
              >
                {operationalCopy.lifecycleReason}
                <Input
                  id={`${formId}-reason`}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  autoComplete="off"
                />
              </label>
              {needsDisposeSubjects ? (
                <div className="block space-y-1.5 text-caption sm:col-span-2">
                  <span id={`${formId}-dispose-persons-label`}>
                    {operationalCopy.lifecyclePersonId}
                  </span>
                  {disposePersons.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {disposePersons.map((p) => (
                        <EntityToken
                          key={p.id}
                          option={p}
                          clearLabelFa="حذف از فهرست"
                          onClear={() =>
                            setDisposePersons((prev) =>
                              prev.filter((x) => x.id !== p.id),
                            )
                          }
                        />
                      ))}
                    </div>
                  ) : null}
                  <EntityPicker
                    id={`${formId}-dispose-persons`}
                    search={personSearch}
                    value={disposeAdd}
                    onValueChange={(next) => {
                      if (next && !disposePersons.some((p) => p.id === next.id)) {
                        setDisposePersons((prev) => [...prev, next]);
                      }
                      setDisposeAdd(null);
                    }}
                    scopeNoteFa="افزودن فرد به فهرست حذف"
                    placeholder="کد یا نام پرسنل…"
                    aria-labelledby={`${formId}-dispose-persons-label`}
                    aria-describedby={`${formId}-dispose-persons-hint`}
                  />
                  <span
                    id={`${formId}-dispose-persons-hint`}
                    className="block text-muted-foreground"
                  >
                    {operationalCopy.lifecycleDisposeSubjectsRequired}
                  </span>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy || !scopeRef || !reason.trim()}
                onClick={(e) => openConfirm("place", e.currentTarget)}
              >
                {operationalCopy.lifecyclePlaceHold}
              </Button>
              <Button
                type="button"
                variant="tertiary"
                disabled={busy || !disposeReady}
                onClick={(e) => openConfirm("dispose", e.currentTarget)}
              >
                {operationalCopy.lifecycleRunDisposal}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-body font-medium">
              {operationalCopy.lifecycleHoldsHeading}
            </h3>
            {holdsQuery.data && holdsQuery.data.holds.length === 0 ? (
              <p className="text-body text-muted-foreground" role="status">
                {operationalCopy.lifecycleHoldsEmpty}
              </p>
            ) : null}
            {holdsQuery.data && holdsQuery.data.holds.length > 0 ? (
              <ul className="divide-y divide-border border border-border text-caption">
                {holdsQuery.data.holds.map((h) => (
                  <li
                    key={h.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                  >
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <ScopeIdentity
                        scopeKind={h.scopeKind}
                        scopeRef={h.scopeRef}
                      />
                      {" · "}
                      {h.status === "active"
                        ? operationalCopy.lifecycleStatusActive
                        : operationalCopy.lifecycleStatusReleased}
                      {" · "}
                      {toPersianDigits(h.placedAt.slice(0, 10))}
                    </span>
                    {h.status === "active" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="tertiary"
                        disabled={busy}
                        onClick={(e) => {
                          setReleaseHoldId(h.id);
                          openConfirm("release", e.currentTarget);
                        }}
                      >
                        {operationalCopy.lifecycleReleaseHold}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="space-y-2">
            <h3 className="text-body font-medium">
              {operationalCopy.lifecycleRunsHeading}
            </h3>
            {runsQuery.data && runsQuery.data.runs.length === 0 ? (
              <p className="text-body text-muted-foreground" role="status">
                {operationalCopy.lifecycleRunsEmpty}
              </p>
            ) : null}
            {runsQuery.data && runsQuery.data.runs.length > 0 ? (
              <ul className="divide-y divide-border border border-border text-caption">
                {runsQuery.data.runs.map((r) => (
                  <li key={r.id} className="space-y-1 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{r.status}</span>
                      {" · "}
                      {toPersianDigits(r.startedAt.slice(0, 10))}
                      {" · "}
                      <ScopeIdentity
                        scopeKind={r.scopeKind}
                        scopeRef={r.scopeRef}
                      />
                    </div>
                    <TechnicalDetailDisclosure
                      value={r.id}
                      valueLabelFa="شناسهٔ فنی اجرای حذف"
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <p className="text-caption text-muted-foreground" role="note">
            {operationalCopy.lifecycleCustodyBoundary}
          </p>
        </>
      ) : null}

      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirm(null);
            restoreFocus();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm === "place"
                ? operationalCopy.lifecyclePlaceHold
                : confirm === "release"
                  ? operationalCopy.lifecycleReleaseHold
                  : operationalCopy.lifecycleRunDisposal}
            </DialogTitle>
            <DialogDescription>
              {confirm === "place"
                ? operationalCopy.lifecycleConfirmPlaceHold
                : confirm === "release"
                  ? operationalCopy.lifecycleConfirmReleaseHold
                  : operationalCopy.lifecycleConfirmRunDisposal}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setConfirm(null);
                restoreFocus();
              }}
            >
              {operationalCopy.lifecycleCancel}
            </Button>
            <Button
              type="button"
              variant={confirm === "dispose" ? "outline" : "primary"}
              disabled={busy}
              onClick={() => {
                if (confirm === "place") {
                  placeMutation.mutate({
                    scopeKind,
                    scopeRef,
                    reason: reason.trim(),
                  });
                } else if (confirm === "release" && releaseHoldId) {
                  releaseMutation.mutate({ holdId: releaseHoldId });
                } else if (confirm === "dispose") {
                  disposeMutation.mutate({
                    scopeKind,
                    scopeRef,
                    reason: reason.trim(),
                    personIds:
                      scopeKind === "person"
                        ? [scopeRef]
                        : needsDisposeSubjects
                          ? parsedDisposePersonIds
                          : undefined,
                    artifactIds:
                      scopeKind === "artifact" ? [scopeRef] : undefined,
                    elementCategory:
                      scopeKind === "element_category" ? scopeRef : undefined,
                  });
                }
              }}
            >
              {operationalCopy.lifecycleConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
