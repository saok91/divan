/**
 * Correction cases panel (Story 7.5 / FR-53 / UX-DR19 / UX-DR22).
 * Restricted case tracking — no employee portal; no general DMS.
 * GovernedDataTable + single-depth Dialog; Persian RTL + digits.
 */

"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import {
  EntityPicker,
  TechnicalDetailDisclosure,
  createDisposalRunSearch,
  createHoldSearch,
  createPersonSearch,
  type EntityPickerValue,
} from "@/components/entity-picker";
import { GlossaryTerm } from "@/components/glossary/glossary-term";
import { GovernedDataTable } from "@/components/governed-data-table";
import type { GovernedColumn } from "@/components/governed-data-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Input } from "@/components/ui/input";
import { RowActionButton } from "@/components/ui/row-action-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Eye } from "lucide-react";
import { formatJalaliDateTimeFromIso } from "@/lib/jalali";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import { api } from "@/lib/trpc/client";
import { isUuid } from "@/lib/is-uuid";

function PersonIdentityCell({ personId }: { personId: string }) {
  const q = api.person.getById.useQuery(
    { id: personId },
    { enabled: Boolean(personId), retry: false },
  );
  if (q.isLoading) {
    return <span className="text-caption text-muted-foreground">…</span>;
  }
  if (q.data) {
    const code = q.data.personnelCode?.trim() || "";
    const name =
      `${q.data.givenName ?? ""} ${q.data.familyName ?? ""}`.trim() || code || "پرسنل";
    return (
      <span className="text-caption">
        {code ? (
          <span className="text-identifier text-primary" dir="ltr">
            {toPersianDigits(code)}
          </span>
        ) : null}
        {code ? " — " : null}
        {name}
      </span>
    );
  }
  return (
    <TechnicalDetailDisclosure
      value={personId}
      valueLabelFa="شناسهٔ فنی فرد"
    />
  );
}

function OutcomeLinkTarget({
  linkType,
  targetId,
}: {
  linkType: string;
  targetId: string;
}) {
  if (linkType === "personnel_correction") {
    return <PersonIdentityCell personId={targetId} />;
  }
  return (
    <TechnicalDetailDisclosure
      value={targetId}
      valueLabelFa={`شناسهٔ فنی ${linkTypeLabel(linkType)}`}
    />
  );
}

type CaseRow = {
  id: string;
  requestReference: string;
  personId: string;
  ownerAccountId: string;
  status: string;
  deadlineAt: string;
  breachedPresentation: boolean;
  decision: string | null;
};

type DialogKind = "open" | "decide" | "close" | "link" | "evidence" | null;

function statusLabel(status: string): string {
  switch (status) {
    case "open":
      return operationalCopy.correctionCaseStatusOpen;
    case "in_progress":
      return operationalCopy.correctionCaseStatusInProgress;
    case "pending_decision":
      return operationalCopy.correctionCaseStatusPendingDecision;
    case "approved":
      return operationalCopy.correctionCaseStatusApproved;
    case "rejected":
      return operationalCopy.correctionCaseStatusRejected;
    case "constrained":
      return operationalCopy.correctionCaseStatusConstrained;
    case "closed":
      return operationalCopy.correctionCaseStatusClosed;
    case "breached":
      return operationalCopy.correctionCaseStatusBreached;
    default:
      return status;
  }
}

function inspectionLabel(status: string): string {
  switch (status) {
    case "allowed":
      return operationalCopy.correctionCaseInspectionAllowed;
    case "rejected":
      return operationalCopy.correctionCaseInspectionRejected;
    case "quarantined":
      return operationalCopy.correctionCaseInspectionQuarantined;
    default:
      return status;
  }
}

function linkTypeLabel(linkType: string): string {
  switch (linkType) {
    case "pending_publication_hook":
      return operationalCopy.correctionCaseLinkPendingPublication;
    case "personnel_correction":
      return operationalCopy.correctionCaseLinkPersonnelCorrection;
    case "disposal_run":
      return operationalCopy.correctionCaseLinkDisposalRun;
    case "hold":
      return operationalCopy.correctionCaseLinkHold;
    case "recalc":
      return operationalCopy.correctionCaseLinkRecalc;
    case "response_evidence":
      return operationalCopy.correctionCaseLinkResponseEvidence;
    case "published_artifact":
      return operationalCopy.correctionCaseLinkPublishedArtifact;
    case "decision_publication":
      return operationalCopy.correctionCaseLinkDecisionPublication;
    default:
      return linkType;
  }
}

function evidenceKindLabel(kind: string): string {
  switch (kind) {
    case "request":
      return operationalCopy.correctionCaseEvidenceKindRequest;
    case "response":
      return operationalCopy.correctionCaseEvidenceKindResponse;
    case "internal":
      return operationalCopy.correctionCaseEvidenceKindInternal;
    case "other":
      return operationalCopy.correctionCaseEvidenceKindOther;
    default:
      return kind;
  }
}

function trpcErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const msg = String((err as { message: unknown }).message ?? "").trim();
    if (msg && !/^(Error|INTERNAL|prisma|ECONN|failed to)/i.test(msg)) {
      return msg;
    }
  }
  return fallback;
}

const COLUMNS: GovernedColumn<CaseRow>[] = [
  {
    id: "requestReference",
    header: operationalCopy.correctionCaseRequestRef,
    accessor: (r) => r.requestReference,
    sortable: true,
    sticky: "identifier",
    cell: (r) => (
      <span className="font-medium">
        {toPersianDigits(r.requestReference)}
        {r.breachedPresentation ? (
          <span className="ms-2 inline-block rounded bg-destructive/15 px-1.5 py-0.5 text-caption text-destructive">
            {operationalCopy.correctionCaseBreachedBadge}
          </span>
        ) : null}
      </span>
    ),
  },
  {
    id: "status",
    header: operationalCopy.correctionCaseStatus,
    accessor: (r) => r.status,
    sortable: true,
    cell: (r) => statusLabel(r.status),
  },
  {
    id: "deadlineAt",
    header: operationalCopy.correctionCaseDeadline,
    accessor: (r) => r.deadlineAt,
    sortable: true,
    cell: (r) =>
      toPersianDigits(formatJalaliDateTimeFromIso(r.deadlineAt) ?? r.deadlineAt),
  },
  {
    id: "personId",
    header: operationalCopy.correctionCasePersonId,
    accessor: (r) => r.personId,
    cell: (r) => <PersonIdentityCell personId={r.personId} />,
  },
];

export function CorrectionCasesPanel() {
  const formId = React.useId();
  const searchParams = useSearchParams();
  const utils = api.useUtils();
  const urlHydratedKeyRef = React.useRef<string | null>(null);
  const [breachedOnly, setBreachedOnly] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<DialogKind>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [urlAccessHintFa, setUrlAccessHintFa] = React.useState<string | null>(
    null,
  );
  const confirmTriggerRef = React.useRef<HTMLElement | null>(null);

  const [requestRef, setRequestRef] = React.useState("");
  const [authority, setAuthority] = React.useState("");
  const [person, setPerson] = React.useState<EntityPickerValue>(null);
  const [deadlineLocal, setDeadlineLocal] = React.useState("");
  const [decision, setDecision] = React.useState<
    "approved" | "rejected" | "constrained"
  >("approved");
  const [decisionReason, setDecisionReason] = React.useState("");
  const [closureNote, setClosureNote] = React.useState("");
  const [linkType, setLinkType] = React.useState<
    | "personnel_correction"
    | "disposal_run"
    | "hold"
    | "recalc"
    | "pending_publication_hook"
    | "response_evidence"
    | "published_artifact"
    | "decision_publication"
  >("decision_publication");
  const [linkTarget, setLinkTarget] = React.useState("");
  const [linkEntity, setLinkEntity] = React.useState<EntityPickerValue>(null);
  const [uploadName, setUploadName] = React.useState("");
  const [uploadB64, setUploadB64] = React.useState("");
  const [evidenceKind, setEvidenceKind] = React.useState<
    "request" | "response" | "internal" | "other"
  >("request");
  const [evidenceUri, setEvidenceUri] = React.useState("");

  const personSearch = React.useMemo(() => createPersonSearch(), []);
  const holdSearch = React.useMemo(() => createHoldSearch(), []);
  const disposalRunSearch = React.useMemo(() => createDisposalRunSearch(), []);
  const linkUsesPersonPicker = linkType === "personnel_correction";
  const linkUsesHoldPicker = linkType === "hold";
  const linkUsesDisposalPicker = linkType === "disposal_run";
  const linkUsesBusinessPicker =
    linkUsesPersonPicker || linkUsesHoldPicker || linkUsesDisposalPicker;
  const resolvedLinkTarget = linkUsesBusinessPicker
    ? (linkEntity?.id?.trim() ?? "")
    : linkTarget.trim();

  const listQuery = api.correctionCase.list.useQuery({
    breachedOnly: breachedOnly || undefined,
  });
  const detailQuery = api.correctionCase.get.useQuery(
    { caseId: selectedId! },
    { enabled: Boolean(selectedId) },
  );
  const capsQuery = api.correctionCase.capabilities.useQuery();

  // Story 9.7 — hydrate ?person= (+ optional open=1) from profile CTA.
  const searchKey = searchParams.toString();
  React.useEffect(() => {
    if (urlHydratedKeyRef.current === searchKey) return;
    if (capsQuery.isLoading) return;

    const personId = searchParams.get("person")?.trim();
    const wantOpen = searchParams.get("open") === "1";

    if (wantOpen && capsQuery.isError) {
      setUrlAccessHintFa(operationalCopy.correctionCaseCapabilitiesError);
      return;
    }

    urlHydratedKeyRef.current = searchKey;

    if (personId && isUuid(personId)) {
      setPerson({ id: personId, code: "", labelFa: "فرد از پیوند پروفایل" });
    }

    if (!wantOpen) return;
    if (capsQuery.data?.write === true) {
      setDialog("open");
      return;
    }
    setUrlAccessHintFa(operationalCopy.profileCorrectionRequestDenied);
  }, [
    searchKey,
    searchParams,
    capsQuery.data,
    capsQuery.isError,
    capsQuery.isLoading,
  ]);

  const openMutation = api.correctionCase.open.useMutation({
    onSuccess: async (res) => {
      setActionError(null);
      setDialog(null);
      setRequestRef("");
      setAuthority("");
      setPerson(null);
      setDeadlineLocal("");
      setSelectedId(res.case.id);
      await utils.correctionCase.list.invalidate();
      restoreFocus();
    },
    onError: (err) => {
      setActionError(
        trpcErrorMessage(err, operationalCopy.correctionCaseActionFailed),
      );
      setDialog(null);
      restoreFocus();
    },
  });

  const decideMutation = api.correctionCase.decide.useMutation({
    onSuccess: async () => {
      setActionError(null);
      setDialog(null);
      setDecisionReason("");
      await Promise.all([
        utils.correctionCase.list.invalidate(),
        utils.correctionCase.get.invalidate(),
      ]);
      restoreFocus();
    },
    onError: (err) => {
      setActionError(
        trpcErrorMessage(err, operationalCopy.correctionCaseActionFailed),
      );
      setDialog(null);
      restoreFocus();
    },
  });

  const closeMutation = api.correctionCase.close.useMutation({
    onSuccess: async () => {
      setActionError(null);
      setDialog(null);
      setClosureNote("");
      await Promise.all([
        utils.correctionCase.list.invalidate(),
        utils.correctionCase.get.invalidate(),
      ]);
      restoreFocus();
    },
    onError: (err) => {
      setActionError(
        trpcErrorMessage(err, operationalCopy.correctionCaseActionFailed),
      );
      setDialog(null);
      restoreFocus();
    },
  });

  const linkMutation = api.correctionCase.linkOutcome.useMutation({
    onSuccess: async () => {
      setActionError(null);
      setDialog(null);
      setLinkTarget("");
      setLinkEntity(null);
      await utils.correctionCase.get.invalidate();
      restoreFocus();
    },
    onError: (err) => {
      setActionError(
        trpcErrorMessage(err, operationalCopy.correctionCaseActionFailed),
      );
      setDialog(null);
      restoreFocus();
    },
  });

  const uploadMutation = api.correctionCase.uploadAttachment.useMutation({
    onSuccess: async () => {
      setActionError(null);
      setUploadName("");
      setUploadB64("");
      await utils.correctionCase.get.invalidate();
    },
    onError: (err) => {
      setActionError(
        trpcErrorMessage(err, operationalCopy.correctionCaseActionFailed),
      );
    },
  });

  const evidenceMutation = api.correctionCase.addEvidenceRef.useMutation({
    onSuccess: async () => {
      setActionError(null);
      setDialog(null);
      setEvidenceUri("");
      await utils.correctionCase.get.invalidate();
      restoreFocus();
    },
    onError: (err) => {
      setActionError(
        trpcErrorMessage(err, operationalCopy.correctionCaseActionFailed),
      );
      setDialog(null);
      restoreFocus();
    },
  });

  const updateMutation = api.correctionCase.update.useMutation({
    onSuccess: async () => {
      setActionError(null);
      await Promise.all([
        utils.correctionCase.list.invalidate(),
        utils.correctionCase.get.invalidate(),
      ]);
    },
    onError: (err) => {
      setActionError(
        trpcErrorMessage(err, operationalCopy.correctionCaseActionFailed),
      );
    },
  });

  function restoreFocus() {
    confirmTriggerRef.current?.focus();
  }

  function openDialog(kind: DialogKind, trigger: HTMLElement) {
    confirmTriggerRef.current = trigger;
    setDialog(kind);
  }

  const rows: CaseRow[] = (listQuery.data?.cases ?? []).map((c) => ({
    id: c.id,
    requestReference: c.requestReference,
    personId: c.personId,
    ownerAccountId: c.ownerAccountId,
    status: c.status,
    deadlineAt: c.deadlineAt,
    breachedPresentation: c.breachedPresentation,
    decision: c.decision,
  }));

  const coldLoading = listQuery.isLoading || capsQuery.isLoading;
  const loadError = listQuery.isError
    ? trpcErrorMessage(
        listQuery.error,
        operationalCopy.correctionCaseLoadError,
      )
    : capsQuery.isError
      ? trpcErrorMessage(
          capsQuery.error,
          operationalCopy.correctionCaseCapabilitiesError,
        )
      : null;

  const caps = capsQuery.data;
  const busy =
    openMutation.isPending ||
    decideMutation.isPending ||
    closeMutation.isPending ||
    linkMutation.isPending ||
    uploadMutation.isPending ||
    updateMutation.isPending ||
    evidenceMutation.isPending;

  async function onFileChosen(file: File | null) {
    if (!file || !selectedId) return;
    const maxBytes = caps?.attachmentMaxBytes;
    if (typeof maxBytes === "number" && file.size > maxBytes) {
      setActionError(operationalCopy.correctionCaseAttachmentTooLarge);
      setUploadName("");
      setUploadB64("");
      return;
    }
    setUploadName(file.name);
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    setUploadB64(btoa(binary));
  }

  async function downloadAttachment(
    attachmentId: string,
    mode: "download" | "preview",
  ) {
    try {
      const data = await utils.correctionCase.downloadAttachment.fetch({
        attachmentId,
        mode,
      });
      const bin = atob(data.contentBase64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const blob = new Blob([arr], {
        type: data.headers["Content-Type"] ?? "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);
      if (mode === "preview") {
        window.open(url, "_blank", "noopener,noreferrer");
        // Revoke later — allow the new tab to load.
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return;
      }
      const a = document.createElement("a");
      a.href = url;
      a.download = data.attachment.originalFilenameMinimized;
      a.rel = "noopener";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(
        trpcErrorMessage(err, operationalCopy.correctionCaseActionFailed),
      );
    }
  }

  return (
    <section
      className="mx-auto max-w-5xl space-y-6 text-text-primary"
      aria-labelledby="correction-cases-heading"
    >
      <header className="space-y-2">
        <p className="text-body text-text-secondary">
          {operationalCopy.correctionCaseIntro}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <GlossaryTerm termKey="correctionCase" />
        </div>
      </header>

      {actionError ? (
        <FeedbackMessage kind="error">{actionError}</FeedbackMessage>
      ) : null}

      {urlAccessHintFa ? (
        <FeedbackMessage kind="error">{urlAccessHintFa}</FeedbackMessage>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={breachedOnly ? "primary" : "outline"}
          size="sm"
          onClick={() => setBreachedOnly((v) => !v)}
        >
          {breachedOnly
            ? operationalCopy.correctionCaseFilterAll
            : operationalCopy.correctionCaseFilterBreached}
        </Button>
        {caps?.write ? (
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={(e) => openDialog("open", e.currentTarget)}
            disabledReason={operationalCopy.actionPending}
          >
            {operationalCopy.correctionCaseOpen}
          </Button>
        ) : capsQuery.isError ? (
          <FeedbackMessage kind="error">
            {operationalCopy.correctionCaseCapabilitiesError}
          </FeedbackMessage>
        ) : !capsQuery.isLoading ? (
          <Button
            type="button"
            size="sm"
            disabled
            disabledReason={operationalCopy.profileCorrectionRequestDenied}
          >
            {operationalCopy.correctionCaseOpen}
          </Button>
        ) : null}
      </div>

      {coldLoading ? (
        <div className="space-y-2" role="status" aria-live="polite">
          <span className="sr-only">{operationalCopy.correctionCaseLoading}</span>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : loadError ? (
        <p className="text-body text-destructive" role="alert">
          {loadError}
        </p>
      ) : (
        <GovernedDataTable
          aria-label={operationalCopy.correctionCaseHeading}
          preferencesKey="correction-cases"
          columns={COLUMNS}
          rows={rows}
          getRowId={(r) => r.id}
          sectionDefaultFilters={{}}
          pageSize={25}
          emptyMessage={operationalCopy.correctionCaseEmpty}
          rowActions={(r) => (
            <RowActionButton
              label={operationalCopy.correctionCaseDetail}
              icon={Eye}
              onClick={() => setSelectedId(r.id)}
            />
          )}
        />
      )}

      <div className="space-y-4 border-t border-border pt-4">
        <h2 className="text-heading-sm">{operationalCopy.correctionCaseDetail}</h2>
        {!selectedId ? (
          <p className="text-caption text-muted-foreground">
            {operationalCopy.correctionCaseNoSelection}
          </p>
        ) : detailQuery.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : detailQuery.isError ? (
          <p className="text-body text-destructive" role="alert">
            {trpcErrorMessage(
              detailQuery.error,
              operationalCopy.correctionCaseLoadError,
            )}
          </p>
        ) : detailQuery.data ? (
          <div className="space-y-3 text-body">
            {detailQuery.data.breachedPresentation ? (
              <p
                className="rounded bg-destructive/10 px-3 py-2 text-destructive"
                role="status"
              >
                {operationalCopy.correctionCaseBreachedBadge}
              </p>
            ) : null}
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-caption text-muted-foreground">
                  {operationalCopy.correctionCaseRequestRef}
                </dt>
                <dd>{toPersianDigits(detailQuery.data.case.requestReference)}</dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">
                  {operationalCopy.correctionCaseStatus}
                </dt>
                <dd>{statusLabel(detailQuery.data.case.status)}</dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">
                  {operationalCopy.correctionCaseOwner}
                </dt>
                <dd>
                  <TechnicalDetailDisclosure
                    value={detailQuery.data.case.ownerAccountId}
                    valueLabelFa="شناسهٔ فنی مالک پرونده"
                  />
                </dd>
              </div>
              <div>
                <dt className="text-caption text-muted-foreground">
                  {operationalCopy.correctionCaseDeadline}
                </dt>
                <dd>
                  {toPersianDigits(
                    formatJalaliDateTimeFromIso(
                      detailQuery.data.case.deadlineAt,
                    ) ?? detailQuery.data.case.deadlineAt,
                  )}
                </dd>
              </div>
              {detailQuery.data.case.decisionReason ? (
                <div className="sm:col-span-2">
                  <dt className="text-caption text-muted-foreground">
                    {operationalCopy.correctionCaseDecisionReason}
                  </dt>
                  <dd>{detailQuery.data.case.decisionReason}</dd>
                </div>
              ) : null}
            </dl>

            <div className="flex flex-wrap gap-2">
              {caps?.write &&
              (detailQuery.data.case.status === "open" ||
                detailQuery.data.case.status === "breached") ? (
                <Button
                  type="button"
                  size="sm"
                  variant="tertiary"
                  disabled={busy}
                  onClick={() =>
                    updateMutation.mutate({
                      caseId: selectedId,
                      toStatus: "in_progress",
                    })
                  }
                
            disabledReason={operationalCopy.actionPending}
          >
                  {operationalCopy.correctionCaseStatusInProgress}
                </Button>
              ) : null}
              {caps?.write &&
              (detailQuery.data.case.status === "in_progress" ||
                detailQuery.data.case.status === "breached") ? (
                <Button
                  type="button"
                  size="sm"
                  variant="tertiary"
                  disabled={busy}
                  onClick={() =>
                    updateMutation.mutate({
                      caseId: selectedId,
                      toStatus: "pending_decision",
                    })
                  }
                
            disabledReason={operationalCopy.actionPending}
          >
                  {operationalCopy.correctionCaseStatusPendingDecision}
                </Button>
              ) : null}
              {caps?.decide &&
              ["pending_decision", "breached"].includes(
                detailQuery.data.case.status,
              ) ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={(e) => openDialog("decide", e.currentTarget)}
                
            disabledReason={operationalCopy.actionPending}
          >
                  {operationalCopy.correctionCaseDecide}
                </Button>
              ) : null}
              {caps?.close &&
              ["approved", "rejected", "constrained"].includes(
                detailQuery.data.case.status,
              ) ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={(e) => openDialog("close", e.currentTarget)}
                
            disabledReason={operationalCopy.actionPending}
          >
                  {operationalCopy.correctionCaseClose}
                </Button>
              ) : null}
              {caps?.write &&
              ["approved", "rejected", "constrained"].includes(
                detailQuery.data.case.status,
              ) ? (
                <Button
                  type="button"
                  size="sm"
                  variant="tertiary"
                  disabled={busy}
                  onClick={(e) => openDialog("link", e.currentTarget)}
                
            disabledReason={operationalCopy.actionPending}
          >
                  {operationalCopy.correctionCaseLinkOutcome}
                </Button>
              ) : null}
              {caps?.write && detailQuery.data.case.status !== "closed" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="tertiary"
                  disabled={busy}
                  onClick={(e) => openDialog("evidence", e.currentTarget)}
                
            disabledReason={operationalCopy.actionPending}
          >
                  {operationalCopy.correctionCaseAddEvidence}
                </Button>
              ) : null}
            </div>

            <div className="space-y-2">
              <h3 className="text-heading-sm">
                {operationalCopy.correctionCaseAttachments}
              </h3>
              {detailQuery.data.attachments.length === 0 ? (
                <p className="text-caption text-muted-foreground">—</p>
              ) : (
                <ul className="space-y-1">
                  {detailQuery.data.attachments.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center gap-2 text-caption"
                    >
                      <span>{a.originalFilenameMinimized}</span>
                      <span className="text-muted-foreground">
                        ({inspectionLabel(a.inspectionStatus)})
                      </span>
                      {a.inspectionStatus === "allowed" ? (
                        <>
                          <RowActionButton
                            label={operationalCopy.correctionCaseDownload}
                            icon={Download}
                            onClick={() =>
                              void downloadAttachment(a.id, "download")
                            }
                          />
                          <RowActionButton
                            label={operationalCopy.correctionCasePreview}
                            icon={Eye}
                            onClick={() =>
                              void downloadAttachment(a.id, "preview")
                            }
                          />
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {caps?.write ? (
                <div className="flex flex-wrap items-end gap-2">
                  <Input
                    type="file"
                    onChange={(e) =>
                      void onFileChosen(e.target.files?.[0] ?? null)
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy || !uploadB64 || !uploadName}
                    onClick={() =>
                      uploadMutation.mutate({
                        caseId: selectedId,
                        filename: uploadName,
                        contentBase64: uploadB64,
                      })
                    }
                  
            disabledReason={operationalCopy.actionPending}
          >
                    {operationalCopy.correctionCaseUpload}
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <h3 className="text-heading-sm">
                {operationalCopy.correctionCaseOutcomeLinks}
              </h3>
              {detailQuery.data.outcomeLinks.length === 0 ? (
                <p className="text-caption text-muted-foreground">—</p>
              ) : (
                <ul className="space-y-1 text-caption">
                  {detailQuery.data.outcomeLinks.map((l) => (
                    <li key={l.id} className="flex flex-wrap items-center gap-2">
                      <span>{linkTypeLabel(l.linkType)}:</span>
                      <OutcomeLinkTarget
                        linkType={l.linkType}
                        targetId={l.targetId}
                      />
                      {l.note ? <span>— {l.note}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-heading-sm">
                {operationalCopy.correctionCaseEvidenceRefs}
              </h3>
              {detailQuery.data.evidenceRefs.length === 0 ? (
                <p className="text-caption text-muted-foreground">—</p>
              ) : (
                <ul className="space-y-1 text-caption">
                  {detailQuery.data.evidenceRefs.map((e) => (
                    <li key={e.id}>
                      {evidenceKindLabel(e.kind)}: {e.uriOrRef}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDialog(null);
            restoreFocus();
          }
        }}
      >
        <DialogContent>
          {dialog === "open" ? (
            <>
              <DialogHeader>
                <DialogTitle>{operationalCopy.correctionCaseOpen}</DialogTitle>
                <DialogDescription>
                  {operationalCopy.correctionCaseConfirmOpen}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <label className="block space-y-1 text-caption">
                  {operationalCopy.correctionCaseRequestRef}
                  <Input
                    value={requestRef}
                    onChange={(e) => setRequestRef(e.target.value)}
                  />
                </label>
                <label className="block space-y-1 text-caption">
                  {operationalCopy.correctionCaseAuthority}
                  <Input
                    value={authority}
                    onChange={(e) => setAuthority(e.target.value)}
                  />
                </label>
                <label className="block space-y-1 text-caption">
                  {operationalCopy.correctionCasePersonId}
                  <EntityPicker
                    id={`${formId}-open-person`}
                    search={personSearch}
                    value={person}
                    onValueChange={setPerson}
                    scopeNoteFa="جستجو با کد پرسنلی یا نام"
                    placeholder="کد یا نام پرسنل…"
                    aria-required
                  />
                </label>
                <label className="block space-y-1 text-caption">
                  {operationalCopy.correctionCaseDeadline}
                  <Input
                    type="datetime-local"
                    value={deadlineLocal}
                    onChange={(e) => setDeadlineLocal(e.target.value)}
                  />
                </label>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDialog(null)}
                >
                  {operationalCopy.correctionCaseCancel}
                </Button>
                <Button
                  type="button"
                  disabled={
                    busy ||
                    !requestRef.trim() ||
                    !authority.trim() ||
                    !(person?.id?.trim()) ||
                    !deadlineLocal
                  }
                  onClick={() =>
                    openMutation.mutate({
                      requestReference: requestRef.trim(),
                      authorityVerifiedBy: authority.trim(),
                      personId: person!.id.trim(),
                      deadlineAt: new Date(deadlineLocal),
                    })
                  }
                
            disabledReason={operationalCopy.actionPending}
          >
                  {operationalCopy.correctionCaseConfirm}
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {dialog === "decide" ? (
            <>
              <DialogHeader>
                <DialogTitle>{operationalCopy.correctionCaseDecide}</DialogTitle>
                <DialogDescription>
                  {operationalCopy.correctionCaseConfirmDecide}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <label className="block space-y-1 text-caption">
                  {operationalCopy.correctionCaseDecision}
                  <select
                    className="w-full rounded border border-border bg-background px-2 py-2"
                    value={decision}
                    onChange={(e) =>
                      setDecision(
                        e.target.value as
                          | "approved"
                          | "rejected"
                          | "constrained",
                      )
                    }
                  >
                    <option value="approved">
                      {operationalCopy.correctionCaseStatusApproved}
                    </option>
                    <option value="rejected">
                      {operationalCopy.correctionCaseStatusRejected}
                    </option>
                    <option value="constrained">
                      {operationalCopy.correctionCaseStatusConstrained}
                    </option>
                  </select>
                </label>
                <label className="block space-y-1 text-caption">
                  {operationalCopy.correctionCaseDecisionReason}
                  <Input
                    value={decisionReason}
                    onChange={(e) => setDecisionReason(e.target.value)}
                  />
                </label>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDialog(null)}
                >
                  {operationalCopy.correctionCaseCancel}
                </Button>
                <Button
                  type="button"
                  disabled={busy || !decisionReason.trim() || !selectedId}
                  onClick={() =>
                    decideMutation.mutate({
                      caseId: selectedId!,
                      decision,
                      decisionReason: decisionReason.trim(),
                    })
                  }
                
            disabledReason={operationalCopy.actionPending}
          >
                  {operationalCopy.correctionCaseConfirm}
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {dialog === "close" ? (
            <>
              <DialogHeader>
                <DialogTitle>{operationalCopy.correctionCaseClose}</DialogTitle>
                <DialogDescription>
                  {operationalCopy.correctionCaseConfirmClose}
                </DialogDescription>
              </DialogHeader>
              <label className="block space-y-1 text-caption">
                {operationalCopy.correctionCaseClosureEvidence}
                <Input
                  value={closureNote}
                  onChange={(e) => setClosureNote(e.target.value)}
                />
              </label>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDialog(null)}
                >
                  {operationalCopy.correctionCaseCancel}
                </Button>
                <Button
                  type="button"
                  disabled={busy || !closureNote.trim() || !selectedId}
                  onClick={() =>
                    closeMutation.mutate({
                      caseId: selectedId!,
                      closureEvidence: { note: closureNote.trim() },
                    })
                  }
                
            disabledReason={operationalCopy.actionPending}
          >
                  {operationalCopy.correctionCaseConfirm}
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {dialog === "link" ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {operationalCopy.correctionCaseLinkOutcome}
                </DialogTitle>
                <DialogDescription>
                  {operationalCopy.correctionCasePendingPublicationHonesty}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <label className="block space-y-1 text-caption">
                  نوع پیوند
                  <select
                    className="w-full rounded border border-border bg-background px-2 py-2"
                    value={linkType}
                    onChange={(e) => {
                      setLinkType(e.target.value as typeof linkType);
                      setLinkEntity(null);
                      setLinkTarget("");
                    }}
                  >
                    <option value="decision_publication">
                      {operationalCopy.correctionCaseLinkDecisionPublication}
                    </option>
                    <option value="published_artifact">
                      {operationalCopy.correctionCaseLinkPublishedArtifact}
                    </option>
                    <option value="pending_publication_hook">
                      {operationalCopy.correctionCaseLinkPendingPublication}
                    </option>
                    <option value="personnel_correction">
                      {operationalCopy.correctionCaseLinkPersonnelCorrection}
                    </option>
                    <option value="disposal_run">
                      {operationalCopy.correctionCaseLinkDisposalRun}
                    </option>
                    <option value="hold">
                      {operationalCopy.correctionCaseLinkHold}
                    </option>
                    <option value="recalc">
                      {operationalCopy.correctionCaseLinkRecalc}
                    </option>
                    <option value="response_evidence">
                      {operationalCopy.correctionCaseLinkResponseEvidence}
                    </option>
                  </select>
                </label>
                <label className="block space-y-1 text-caption">
                  {linkUsesPersonPicker
                    ? "هدف (فرد)"
                    : linkUsesHoldPicker
                      ? "هدف (نگهداری قانونی)"
                      : linkUsesDisposalPicker
                        ? "هدف (اجرای حذف)"
                        : "مرجع فنی هدف"}
                  {linkUsesPersonPicker ? (
                    <EntityPicker
                      id={`${formId}-link-person`}
                      search={personSearch}
                      value={linkEntity}
                      onValueChange={setLinkEntity}
                      scopeNoteFa="جستجو با کد پرسنلی یا نام"
                      placeholder="کد یا نام پرسنل…"
                    />
                  ) : linkUsesHoldPicker ? (
                    <EntityPicker
                      id={`${formId}-link-hold`}
                      search={holdSearch}
                      value={linkEntity}
                      onValueChange={setLinkEntity}
                      scopeNoteFa="نگهداری‌های قابل‌مشاهده"
                      placeholder="محدوده یا دلیل نگهداری…"
                    />
                  ) : linkUsesDisposalPicker ? (
                    <EntityPicker
                      id={`${formId}-link-disposal`}
                      search={disposalRunSearch}
                      value={linkEntity}
                      onValueChange={setLinkEntity}
                      scopeNoteFa="اجراهای حذف قابل‌مشاهده"
                      placeholder="محدوده یا وضعیت اجرا…"
                    />
                  ) : (
                    <>
                      <Input
                        value={linkTarget}
                        onChange={(e) => setLinkTarget(e.target.value)}
                        dir="ltr"
                        placeholder="شناسهٔ همبستگی / مرجع فنی"
                        aria-describedby={`${formId}-link-tech-hint`}
                      />
                      <span
                        id={`${formId}-link-tech-hint`}
                        className="block text-muted-foreground"
                      >
                        برای انواع بدون انتخابگر کسب‌وکار — فقط همبستگی پشتیبانی
                      </span>
                    </>
                  )}
                </label>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDialog(null)}
                >
                  {operationalCopy.correctionCaseCancel}
                </Button>
                <Button
                  type="button"
                  disabled={busy || !resolvedLinkTarget || !selectedId}
                  onClick={() =>
                    linkMutation.mutate({
                      caseId: selectedId!,
                      linkType,
                      targetId: resolvedLinkTarget,
                    })
                  }
                
            disabledReason={operationalCopy.actionPending}
          >
                  {operationalCopy.correctionCaseConfirm}
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {dialog === "evidence" ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {operationalCopy.correctionCaseAddEvidence}
                </DialogTitle>
                <DialogDescription>
                  {operationalCopy.correctionCaseEvidenceRefs}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <label className="block space-y-1 text-caption">
                  نوع
                  <select
                    className="w-full rounded border border-border bg-background px-2 py-2"
                    value={evidenceKind}
                    onChange={(e) =>
                      setEvidenceKind(e.target.value as typeof evidenceKind)
                    }
                  >
                    <option value="request">
                      {operationalCopy.correctionCaseEvidenceKindRequest}
                    </option>
                    <option value="response">
                      {operationalCopy.correctionCaseEvidenceKindResponse}
                    </option>
                    <option value="internal">
                      {operationalCopy.correctionCaseEvidenceKindInternal}
                    </option>
                    <option value="other">
                      {operationalCopy.correctionCaseEvidenceKindOther}
                    </option>
                  </select>
                </label>
                <label className="block space-y-1 text-caption">
                  {operationalCopy.correctionCaseEvidenceUri}
                  <Input
                    value={evidenceUri}
                    onChange={(e) => setEvidenceUri(e.target.value)}
                  />
                </label>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDialog(null)}
                >
                  {operationalCopy.correctionCaseCancel}
                </Button>
                <Button
                  type="button"
                  disabled={busy || !evidenceUri.trim() || !selectedId}
                  onClick={() =>
                    evidenceMutation.mutate({
                      caseId: selectedId!,
                      kind: evidenceKind,
                      uriOrRef: evidenceUri.trim(),
                    })
                  }
                
            disabledReason={operationalCopy.actionPending}
          >
                  {operationalCopy.correctionCaseConfirm}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
