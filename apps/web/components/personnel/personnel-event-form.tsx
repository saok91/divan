"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { JalaliDatePicker } from "@/components/jalali-date-picker";
import {
  useLeaveGuardOptional,
  useLeaveGuardRegistration,
} from "@/components/leave-guard";
import { HeadcountCapacityPanel } from "@/components/personnel/headcount-capacity-panel";
import {
  ConflictList,
  SensitiveConfirmationDialog,
} from "@/components/personnel/sensitive-confirmation-dialog";
import {
  StatusBadge,
  isStatusBadgeKind,
  type StatusBadgeKind,
} from "@/components/personnel/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePlatformStatus } from "@/components/platform-status-provider";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type Conflict = {
  code: string;
  severity: "blocking" | "warning";
  messageFa: string;
  requiresAck?: boolean;
  requiresOverride?: boolean;
};

const EVENT_TYPE_OPTIONS = [
  { value: "ScaffoldChangeRecorded", labelFa: "اسکفولد (آزمایش بستر)" },
  { value: "EmploymentStarted", labelFa: "شروع همکاری (EmploymentStarted)" },
  { value: "EmploymentReturned", labelFa: "بازگشت همکاری (EmploymentReturned)" },
  {
    value: "EmploymentTerminated",
    labelFa: "خاتمه همکاری (EmploymentTerminated)",
  },
  { value: "TransferRecorded", labelFa: "انتقال (TransferRecorded)" },
  {
    value: "OrganizationalRoleChanged",
    labelFa: "تغییر نقش سازمانی",
  },
  { value: "JobTitleChanged", labelFa: "تغییر عنوان شغلی" },
  { value: "SeniorityChanged", labelFa: "تغییر ارشدیت" },
  { value: "LadderChanged", labelFa: "تغییر لدر" },
  { value: "GradeChanged", labelFa: "تغییر گرید" },
  { value: "PromotionRecorded", labelFa: "ثبت ارتقا (نتیجه نهایی)" },
  { value: "CompensationChanged", labelFa: "تغییر جبران‌خدمت" },
  { value: "ContractChanged", labelFa: "تغییر قرارداد" },
] as const;

function isStartReturnType(eventType: string): boolean {
  return (
    eventType === "EmploymentStarted" || eventType === "EmploymentReturned"
  );
}

function isTerminationType(eventType: string): boolean {
  return eventType === "EmploymentTerminated";
}

function isTransferType(eventType: string): boolean {
  return eventType === "TransferRecorded";
}

function isJobLevelType(eventType: string): boolean {
  return (
    eventType === "OrganizationalRoleChanged" ||
    eventType === "JobTitleChanged" ||
    eventType === "SeniorityChanged" ||
    eventType === "LadderChanged" ||
    eventType === "GradeChanged" ||
    eventType === "PromotionRecorded"
  );
}

function isJobCapacityType(eventType: string): boolean {
  return (
    eventType === "JobTitleChanged" || eventType === "SeniorityChanged"
  );
}

function isCompensationType(eventType: string): boolean {
  return (
    eventType === "CompensationChanged" || eventType === "ContractChanged"
  );
}

type LifecycleOp = "cancel" | "reverse" | "correct";

function formatChainLinksFa(links: {
  cancellations: string[];
  reversals: string[];
  corrections: string[];
}): string | null {
  const parts: string[] = [];
  if (links.cancellations.length > 0) {
    parts.push(
      `لغو: ${links.cancellations.map((id) => id.slice(0, 8)).join("، ")}`,
    );
  }
  if (links.reversals.length > 0) {
    parts.push(
      `بازگشت: ${links.reversals.map((id) => id.slice(0, 8)).join("، ")}`,
    );
  }
  if (links.corrections.length > 0) {
    parts.push(
      `اصلاح: ${links.corrections.map((id) => id.slice(0, 8)).join("، ")}`,
    );
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

type PersonnelEventFormProps = {
  /** Prefill from `/personnel-events/register?person=` (Story 4b.7). */
  initialPersonId?: string;
};

/**
 * Minimal فرم رویداد (UX-DR11) — Stories 4.2–4.3; relocated in 4b.7.
 * Save draft ≠ Finalize. Lifecycle Cancel/Reverse/Correct append-only.
 */
export function PersonnelEventForm({
  initialPersonId,
}: PersonnelEventFormProps) {
  const formId = React.useId();
  const router = useRouter();
  const leaveGuard = useLeaveGuardOptional();
  const {
    isGoldCtaBlocked,
    isFinalizeBlockedByAuthzChange,
    isMutationBlockedByAuthzChange,
    setDemoDraftOpen,
    setDemoDraftSaved,
    registerPersonnelDraftSaveHandler,
  } = usePlatformStatus();

  const [personId, setPersonId] = React.useState(() =>
    initialPersonId?.trim() ? initialPersonId.trim() : "",
  );
  const [employmentId, setEmploymentId] = React.useState("");
  const [eventType, setEventType] = React.useState("ScaffoldChangeRecorded");
  const [effectiveDate, setEffectiveDate] = React.useState("");
  const [collaborationType, setCollaborationType] = React.useState("employee");
  const [teamId, setTeamId] = React.useState("");
  const [organizationalRoleId, setOrganizationalRoleId] = React.useState("");
  const [jobTitleId, setJobTitleId] = React.useState("");
  const [ladderId, setLadderId] = React.useState("");
  const [gradeId, setGradeId] = React.useState("");
  const [seniorityId, setSeniorityId] = React.useState("");
  const [clearSeniority, setClearSeniority] = React.useState(false);
  const [preferredApprovalId, setPreferredApprovalId] = React.useState("");
  const [terminationReason, setTerminationReason] =
    React.useState("contract_ended");
  const [overrideReason, setOverrideReason] = React.useState("");
  const [currency, setCurrency] = React.useState("IRR");
  const [changeType, setChangeType] = React.useState("");
  const [contractType, setContractType] = React.useState("");
  const [compensationAmount, setCompensationAmount] = React.useState("");
  const [draftId, setDraftId] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState(1);
  const [statusMsg, setStatusMsg] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [conflicts, setConflicts] = React.useState<Conflict[]>([]);
  const [ackCodes, setAckCodes] = React.useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  /** Snapshot of last-saved (or initial empty) fields for leave-guard Discard. */
  type FormSnapshot = {
    personId: string;
    employmentId: string;
    eventType: string;
    effectiveDate: string;
    collaborationType: string;
    teamId: string;
    organizationalRoleId: string;
    jobTitleId: string;
    ladderId: string;
    gradeId: string;
    seniorityId: string;
    clearSeniority: boolean;
    preferredApprovalId: string;
    terminationReason: string;
    overrideReason: string;
    currency: string;
    changeType: string;
    contractType: string;
    compensationAmount: string;
    draftId: string | null;
    version: number;
  };

  const emptySnapshot = React.useCallback((): FormSnapshot => ({
    personId: "",
    employmentId: "",
    eventType: "ScaffoldChangeRecorded",
    effectiveDate: "",
    collaborationType: "employee",
    teamId: "",
    organizationalRoleId: "",
    jobTitleId: "",
    ladderId: "",
    gradeId: "",
    seniorityId: "",
    clearSeniority: false,
    preferredApprovalId: "",
    terminationReason: "contract_ended",
    overrideReason: "",
    currency: "IRR",
    changeType: "",
    contractType: "",
    compensationAmount: "",
    draftId: null,
    version: 1,
  }), []);

  const lastSavedRef = React.useRef<FormSnapshot>(
    initialPersonId?.trim()
      ? { ...emptySnapshot(), personId: initialPersonId.trim() }
      : emptySnapshot(),
  );

  const applySnapshot = React.useCallback((snap: FormSnapshot) => {
    setPersonId(snap.personId);
    setEmploymentId(snap.employmentId);
    setEventType(snap.eventType);
    setEffectiveDate(snap.effectiveDate);
    setCollaborationType(snap.collaborationType);
    setTeamId(snap.teamId);
    setOrganizationalRoleId(snap.organizationalRoleId);
    setJobTitleId(snap.jobTitleId);
    setLadderId(snap.ladderId);
    setGradeId(snap.gradeId);
    setSeniorityId(snap.seniorityId);
    setClearSeniority(snap.clearSeniority);
    setPreferredApprovalId(snap.preferredApprovalId);
    setTerminationReason(snap.terminationReason);
    setOverrideReason(snap.overrideReason);
    setCurrency(snap.currency);
    setChangeType(snap.changeType);
    setContractType(snap.contractType);
    setCompensationAmount(snap.compensationAmount);
    setDraftId(snap.draftId);
    setVersion(snap.version);
  }, []);

  // Prefill: host passes `initialPersonId` from ?person=; dirty inbound uses leave-guard first.
  // Clear preferred approval when event type changes (inline in select onChange).

  const [lifecycleOp, setLifecycleOp] = React.useState<LifecycleOp | null>(
    null,
  );
  const [lifecycleEventId, setLifecycleEventId] = React.useState<string | null>(
    null,
  );
  const [lifecycleReason, setLifecycleReason] = React.useState("");

  const createMut = api.personnelEvent.draftCreate.useMutation();
  const updateMut = api.personnelEvent.draftUpdate.useMutation();
  const deleteMut = api.personnelEvent.draftDelete.useMutation();
  const finalizeMut = api.personnelEvent.finalize.useMutation();
  const putSidecarMut = api.personnelEvent.putCompensationSidecar.useMutation();
  const cancelMut = api.personnelEvent.cancel.useMutation();
  const reverseMut = api.personnelEvent.reverse.useMutation();
  const correctMut = api.personnelEvent.correct.useMutation();
  const evaluateQuery = api.personnelEvent.evaluate.useQuery(
    { draftId: draftId! },
    { enabled: Boolean(draftId) && confirmOpen },
  );
  const eventsQuery = api.personnelEvent.listForPerson.useQuery(
    { personId: personId.trim(), limit: 20 },
    { enabled: Boolean(personId.trim()) },
  );
  const lifecycleCapsQuery = api.personnelEvent.lifecycleCaps.useQuery();
  const canCancel = lifecycleCapsQuery.data?.cancel === true;
  const canReverse = lifecycleCapsQuery.data?.reverse === true;
  const canCorrect = lifecycleCapsQuery.data?.correct === true;

  const sourcePrimaryQuery = api.personnelEvent.sourcePrimarySummary.useQuery(
    {
      employmentId: employmentId.trim(),
      asOfDate: effectiveDate.trim(),
    },
    {
      enabled:
        (isTransferType(eventType) || isJobLevelType(eventType)) &&
        Boolean(employmentId.trim()) &&
        Boolean(effectiveDate.trim()) &&
        /^[0-9a-f-]{36}$/i.test(employmentId.trim()) &&
        /^\d{4}-\d{2}-\d{2}$/.test(effectiveDate.trim()),
    },
  );

  const capacityTeamId =
    teamId.trim() || sourcePrimaryQuery.data?.teamId || "";
  const capacityJobTitleId =
    jobTitleId.trim() || sourcePrimaryQuery.data?.jobTitleId || "";

  const capacityQuery = api.personnelEvent.headcountCapacity.useQuery(
    {
      teamId: capacityTeamId,
      effectiveDate: effectiveDate.trim(),
      jobTitleId: capacityJobTitleId || undefined,
      seniorityId: seniorityId.trim() || undefined,
      preferredApprovalId: preferredApprovalId.trim() || undefined,
      // Transfer: never foreshadow source exemption (destination must rematch).
      primaryAssignmentId: isTransferType(eventType)
        ? undefined
        : sourcePrimaryQuery.data?.id,
    },
    {
      enabled:
        (isTransferType(eventType) ||
          isJobCapacityType(eventType) ||
          isStartReturnType(eventType)) &&
        Boolean(capacityTeamId) &&
        Boolean(effectiveDate.trim()) &&
        /^[0-9a-f-]{36}$/i.test(capacityTeamId),
    },
  );

  const compatibleApprovalsQuery = api.headcount.listCompatibleApprovals.useQuery(
    {
      teamId: capacityTeamId,
      jobTitleId: capacityJobTitleId,
      seniorityId: seniorityId.trim() || null,
      evaluationDate: effectiveDate.trim(),
    },
    {
      enabled:
        (isTransferType(eventType) ||
          isJobCapacityType(eventType) ||
          isStartReturnType(eventType)) &&
        Boolean(capacityTeamId) &&
        Boolean(capacityJobTitleId) &&
        Boolean(effectiveDate.trim()) &&
        /^[0-9a-f-]{36}$/i.test(capacityTeamId) &&
        /^[0-9a-f-]{36}$/i.test(capacityJobTitleId),
    },
  );

  const dictionaryQuery = api.person.listDictionary.useQuery(undefined, {
    enabled: isCompensationType(eventType),
  });
  const enabledElementIds = React.useMemo(() => {
    const set = new Set<string>();
    for (const row of dictionaryQuery.data ?? []) {
      if (row.enabled) set.add(row.elementId);
    }
    return set;
  }, [dictionaryQuery.data]);
  const showCompField = React.useCallback(
    (elementId: string) => enabledElementIds.has(elementId),
    [enabledElementIds],
  );

  React.useEffect(() => {
    setDemoDraftOpen(Boolean(draftId) || dirty);
  }, [draftId, dirty, setDemoDraftOpen]);

  const buildPayload = React.useCallback((): Record<string, unknown> => {
    if (isTerminationType(eventType)) {
      return {
        terminationReason: terminationReason.trim(),
        ...(employmentId.trim()
          ? { employmentId: employmentId.trim() }
          : {}),
      };
    }
    if (isTransferType(eventType)) {
      const payload: Record<string, unknown> = {
        teamId: teamId.trim(),
        organizationalRoleId: organizationalRoleId.trim(),
        jobTitleId: jobTitleId.trim(),
        ladderId: ladderId.trim(),
        gradeId: gradeId.trim(),
      };
      if (seniorityId.trim()) payload.seniorityId = seniorityId.trim();
      if (employmentId.trim()) payload.employmentId = employmentId.trim();
      if (preferredApprovalId.trim()) {
        payload.preferredApprovalId = preferredApprovalId.trim();
      }
      return payload;
    }
    if (isJobLevelType(eventType)) {
      const payload: Record<string, unknown> = {};
      if (employmentId.trim()) payload.employmentId = employmentId.trim();
      if (eventType === "OrganizationalRoleChanged") {
        payload.organizationalRoleId = organizationalRoleId.trim();
      } else if (eventType === "JobTitleChanged") {
        payload.jobTitleId = jobTitleId.trim();
      } else if (eventType === "SeniorityChanged") {
        if (clearSeniority) {
          payload.seniorityId = null;
        } else if (seniorityId.trim()) {
          payload.seniorityId = seniorityId.trim();
        }
        // Omit key when untouched — parser requires explicit set or clear
      } else if (eventType === "LadderChanged") {
        payload.ladderId = ladderId.trim();
        payload.gradeId = gradeId.trim();
      } else if (
        eventType === "GradeChanged" ||
        eventType === "PromotionRecorded"
      ) {
        payload.gradeId = gradeId.trim();
        if (ladderId.trim()) payload.ladderId = ladderId.trim();
      }
      if (
        isJobCapacityType(eventType) &&
        preferredApprovalId.trim()
      ) {
        payload.preferredApprovalId = preferredApprovalId.trim();
      }
      return payload;
    }
    if (isCompensationType(eventType)) {
      const payload: Record<string, unknown> = {};
      if (employmentId.trim()) payload.employmentId = employmentId.trim();
      if (eventType === "CompensationChanged") {
        if (currency.trim()) payload.currency = currency.trim();
        if (changeType.trim()) payload.changeType = changeType.trim();
      } else {
        if (contractType.trim()) payload.contractType = contractType.trim();
        if (collaborationType.trim()) {
          payload.collaborationType = collaborationType.trim();
        }
      }
      return payload;
    }
    if (!isStartReturnType(eventType)) return {};
    const payload: Record<string, unknown> = {
      collaborationType: collaborationType.trim(),
      teamId: teamId.trim(),
      organizationalRoleId: organizationalRoleId.trim(),
      jobTitleId: jobTitleId.trim(),
      ladderId: ladderId.trim(),
      gradeId: gradeId.trim(),
    };
    if (seniorityId.trim()) payload.seniorityId = seniorityId.trim();
    if (preferredApprovalId.trim()) {
      payload.preferredApprovalId = preferredApprovalId.trim();
    }
    return payload;
  }, [
    eventType,
    collaborationType,
    teamId,
    organizationalRoleId,
    jobTitleId,
    ladderId,
    gradeId,
    seniorityId,
    clearSeniority,
    preferredApprovalId,
    terminationReason,
    employmentId,
    currency,
    changeType,
    contractType,
  ]);

  const saveDraft = React.useCallback(async (): Promise<boolean> => {
    setErrorMsg(null);
    try {
      if (!personId.trim() || !effectiveDate.trim() || !eventType.trim()) {
        setErrorMsg("فرد، نوع رویداد و تاریخ مؤثر الزامی است.");
        return false;
      }
      if (isStartReturnType(eventType)) {
        if (
          !collaborationType.trim() ||
          !teamId.trim() ||
          !organizationalRoleId.trim() ||
          !jobTitleId.trim() ||
          !ladderId.trim() ||
          !gradeId.trim()
        ) {
          setErrorMsg(
            "برای شروع/بازگشت، نوع همکاری، تیم، نقش، عنوان شغلی، لدر و گرید الزامی است.",
          );
          return false;
        }
      }
      if (isTerminationType(eventType)) {
        if (!employmentId.trim()) {
          setErrorMsg("برای خاتمه، شناسه همکاری باز الزامی است.");
          return false;
        }
        if (!terminationReason.trim()) {
          setErrorMsg("برای خاتمه، کد دلیل خاتمه الزامی است.");
          return false;
        }
      }
      if (isTransferType(eventType)) {
        if (!employmentId.trim()) {
          setErrorMsg("برای انتقال، شناسه همکاری باز الزامی است.");
          return false;
        }
        if (
          !teamId.trim() ||
          !organizationalRoleId.trim() ||
          !jobTitleId.trim() ||
          !ladderId.trim() ||
          !gradeId.trim()
        ) {
          setErrorMsg(
            "برای انتقال، تیم مقصد، نقش، عنوان شغلی، لدر و گرید الزامی است.",
          );
          return false;
        }
      }
      if (isJobLevelType(eventType)) {
        if (!employmentId.trim()) {
          setErrorMsg("برای تغییر شغلی، شناسه همکاری باز الزامی است.");
          return false;
        }
      }
      if (isCompensationType(eventType)) {
        if (!employmentId.trim()) {
          setErrorMsg("برای تغییر جبران‌خدمت/قرارداد، شناسه همکاری الزامی است.");
          return false;
        }
        if (
          eventType === "CompensationChanged" &&
          !compensationAmount.trim()
        ) {
          setErrorMsg("مبلغ جبران‌خدمت الزامی است (از کانال حساس ذخیره می‌شود).");
          return false;
        }
      }
      const payload = buildPayload();
      let savedId = draftId;
      let savedVersion = version;
      if (draftId) {
        const updated = await updateMut.mutateAsync({
          draftId,
          expectedVersion: version,
          employmentId: employmentId.trim() || null,
          eventType: eventType.trim(),
          effectiveDate: effectiveDate.trim(),
          payload,
        });
        savedVersion = updated.version;
        savedId = updated.id;
        setVersion(updated.version);
        setDraftId(updated.id);
      } else {
        const created = await createMut.mutateAsync({
          personId: personId.trim(),
          employmentId: employmentId.trim() || null,
          eventType: eventType.trim(),
          effectiveDate: effectiveDate.trim(),
          payload,
        });
        savedId = created.id;
        savedVersion = created.version;
        setDraftId(created.id);
        setVersion(created.version);
      }
      if (
        eventType === "CompensationChanged" &&
        savedId &&
        compensationAmount.trim()
      ) {
        await putSidecarMut.mutateAsync({
          draftId: savedId,
          amount: compensationAmount.trim(),
        });
      }
      setDirty(false);
      setDemoDraftSaved(true);
      setStatusMsg("پیش‌نویس ذخیره شد (غیررسمی — وضعیت فعلی تغییر نکرد).");
      lastSavedRef.current = {
        personId,
        employmentId,
        eventType,
        effectiveDate,
        collaborationType,
        teamId,
        organizationalRoleId,
        jobTitleId,
        ladderId,
        gradeId,
        seniorityId,
        clearSeniority,
        preferredApprovalId,
        terminationReason,
        overrideReason,
        currency,
        changeType,
        contractType,
        compensationAmount,
        draftId: savedId ?? null,
        version: savedVersion,
      };
      return true;
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "ذخیره پیش‌نویس ناموفق بود.";
      setErrorMsg(msg);
      return false;
    }
  }, [
    personId,
    employmentId,
    eventType,
    effectiveDate,
    collaborationType,
    teamId,
    organizationalRoleId,
    jobTitleId,
    ladderId,
    gradeId,
    terminationReason,
    compensationAmount,
    clearSeniority,
    preferredApprovalId,
    overrideReason,
    currency,
    changeType,
    contractType,
    buildPayload,
    draftId,
    version,
    createMut,
    updateMut,
    putSidecarMut,
    setDemoDraftSaved,
  ]);

  React.useEffect(() => {
    registerPersonnelDraftSaveHandler(saveDraft);
    return () => registerPersonnelDraftSaveHandler(null);
  }, [registerPersonnelDraftSaveHandler, saveDraft]);

  const onLeaveDiscard = React.useCallback(() => {
    applySnapshot(lastSavedRef.current);
    setDirty(false);
    setConflicts([]);
    setErrorMsg(null);
    setStatusMsg(null);
    setDemoDraftOpen(Boolean(lastSavedRef.current.draftId));
  }, [applySnapshot, setDemoDraftOpen]);

  // Shell leave-guard (sidebar / tabs / palette / history). beforeunload is centralized in LeaveGuardProvider.
  useLeaveGuardRegistration({
    id: "personnel-event-form",
    isDirty: dirty,
    onSave: saveDraft,
    onDiscard: onLeaveDiscard,
  });

  const dirtyRef = React.useRef(dirty);
  const personIdRef = React.useRef(personId);
  const inboundReconcileRef = React.useRef(false);
  React.useLayoutEffect(() => {
    dirtyRef.current = dirty;
    personIdRef.current = personId;
  });

  /** Inbound `?person=` while mounted — leave-guard before swap; never silent wipe (AC #6). */
  React.useEffect(() => {
    const inbound = initialPersonId?.trim() ?? "";
    if (inbound === personIdRef.current) return;
    if (inboundReconcileRef.current) return;

    if (!dirtyRef.current) {
      queueMicrotask(() => {
        if (inbound === personIdRef.current || dirtyRef.current) return;
        setPersonId(inbound);
        lastSavedRef.current = { ...lastSavedRef.current, personId: inbound };
      });
      return;
    }

    const targetHref = inbound
      ? `/personnel-events/register?person=${encodeURIComponent(inbound)}`
      : "/personnel-events/register";
    const stayHref = personIdRef.current
      ? `/personnel-events/register?person=${encodeURIComponent(personIdRef.current)}`
      : "/personnel-events/register";

    if (!leaveGuard) {
      router.replace(stayHref);
      return;
    }

    inboundReconcileRef.current = true;
    void leaveGuard.requestNavigation(targetHref).then((ok) => {
      inboundReconcileRef.current = false;
      if (ok) {
        setPersonId(inbound);
        lastSavedRef.current = { ...lastSavedRef.current, personId: inbound };
        return;
      }
      router.replace(stayHref);
    });
  }, [initialPersonId, leaveGuard, router]);

  // Sync evaluate → local conflicts for form-level ack UI (same as pre-4b.7).
  /* eslint-disable react-hooks/set-state-in-effect -- intentional evaluate→conflicts bridge */
  React.useEffect(() => {
    if (evaluateQuery.data?.conflicts) {
      setConflicts(evaluateQuery.data.conflicts as Conflict[]);
    }
  }, [evaluateQuery.data]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const evaluatedConflicts = (evaluateQuery.data?.conflicts ??
    []) as Conflict[];
  /** While confirm is open, always trust evaluate payload (including empty). */
  const activeConflicts = confirmOpen ? evaluatedConflicts : conflicts;

  const blocking = activeConflicts.some((c) => c.severity === "blocking");
  const warningsNeedingAck = activeConflicts.filter(
    (c) => c.severity === "warning" && c.requiresAck,
  );
  const overrideCodes = activeConflicts.filter((c) => c.requiresOverride);
  const needsOverride = overrideCodes.length > 0;
  const hasScheduledException = activeConflicts.some(
    (c) =>
      c.code === "HEADCOUNT_SCHEDULED_EXCEPTION" ||
      c.code?.includes("SCHEDULED_EXCEPTION"),
  );
  const ackComplete = warningsNeedingAck.every((w) => ackCodes.has(w.code));
  const overrideComplete =
    !needsOverride || overrideReason.trim().length >= 3;
  const finalizeBlocked =
    isGoldCtaBlocked ||
    isFinalizeBlockedByAuthzChange ||
    blocking ||
    !ackComplete ||
    !overrideComplete;

  async function onFinalizeConfirm() {
    if (!draftId || finalizeBlocked) return;
    setErrorMsg(null);
    try {
      const result = await finalizeMut.mutateAsync({
        draftId,
        expectedVersion: version,
        idempotencyKey: `ui-${draftId}`,
        acknowledgement:
          warningsNeedingAck.length > 0
            ? { warningCodes: [...ackCodes] }
            : undefined,
        override: needsOverride
          ? {
              reason: overrideReason.trim(),
              approvedByAccountId: "server-bound",
            }
          : undefined,
      });
      if (result.outcome === "finalized") {
        setStatusMsg(
          `نهایی شد. رویداد معتبر: ${result.eventId} (${result.status})`,
        );
        setDraftId(null);
        setVersion(1);
        setDirty(false);
        setDemoDraftOpen(false);
        setConfirmOpen(false);
        setConflicts([]);
        void eventsQuery.refetch();
      } else if (result.outcome === "pending_review") {
        setStatusMsg(result.messageFa);
        setVersion(result.draft.version);
        setConfirmOpen(false);
      }
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "نهایی‌سازی ناموفق بود.";
      setErrorMsg(msg);
    }
  }

  async function onDelete() {
    if (!draftId) return;
    try {
      await deleteMut.mutateAsync({
        draftId,
        expectedVersion: version,
      });
      setDraftId(null);
      setVersion(1);
      setDirty(false);
      setDemoDraftOpen(false);
      setStatusMsg("پیش‌نویس حذف شد.");
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "حذف پیش‌نویس ناموفق بود.";
      setErrorMsg(msg);
    }
  }

  function openLifecycle(op: LifecycleOp, eventId: string) {
    setLifecycleOp(op);
    setLifecycleEventId(eventId);
    setLifecycleReason("");
    setErrorMsg(null);
  }

  async function onLifecycleConfirm() {
    if (!lifecycleOp || !lifecycleEventId || !lifecycleReason.trim()) return;
    if (isMutationBlockedByAuthzChange) return;
    setErrorMsg(null);
    try {
      const input = {
        eventId: lifecycleEventId,
        reason: lifecycleReason.trim(),
        idempotencyKey: `ui-${lifecycleOp}-${lifecycleEventId}`,
      };
      if (lifecycleOp === "cancel") {
        const r = await cancelMut.mutateAsync(input);
        setStatusMsg(
          `لغو ثبت شد: ${r.neutralizingEventId} (وضعیت حل‌شده: لغوشده)`,
        );
      } else if (lifecycleOp === "reverse") {
        const r = await reverseMut.mutateAsync(input);
        setStatusMsg(
          `بازگشت ثبت شد: ${r.neutralizingEventId} (وضعیت حل‌شده: بازگشت‌خورده)`,
        );
      } else {
        const r = await correctMut.mutateAsync(input);
        setStatusMsg(
          `اصلاح ثبت شد: ${r.neutralizingEventId} — اصل تاریخچه حفظ می‌شود`,
        );
      }
      setLifecycleOp(null);
      setLifecycleEventId(null);
      setLifecycleReason("");
      void eventsQuery.refetch();
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "عملیات چرخه رویداد ناموفق بود.";
      setErrorMsg(msg);
    }
  }

  const lifecycleBusy =
    cancelMut.isPending || reverseMut.isPending || correctMut.isPending;

  const lifecycleTitle =
    lifecycleOp === "cancel"
      ? "تأیید لغو رویداد"
      : lifecycleOp === "reverse"
        ? "تأیید بازگشت رویداد"
        : "تأیید اصلاح رویداد";

  return (
    <section
      className="mx-auto max-w-4xl space-y-6"
      aria-labelledby={`${formId}-title`}
    >
      <header className="space-y-1">
        <h2 id={`${formId}-title`} className="text-title-medium">
          فرم رویداد پرسنلی
        </h2>
        <p className="text-body text-muted-foreground">
          ذخیره پیش‌نویس وضعیت فعلی را تغییر نمی‌دهد. نهایی‌سازی رویداد معتبر
          می‌سازد. لغو/بازگشت/اصلاح اصل را پاک نمی‌کند.
        </p>
      </header>

      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void saveDraft();
        }}
        onChange={() => setDirty(true)}
      >
        <fieldset className="space-y-3">
          <legend className="text-label-medium">شناسه‌ها</legend>
          <label className="block space-y-1">
            <span className="text-label-medium">
              شناسه فرد <span className="text-destructive">*</span>
            </span>
            <Input
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              required
              dir="ltr"
              autoComplete="off"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-label-medium">
              شناسه همکاری
              {isTerminationType(eventType) ||
              isTransferType(eventType) ||
              isJobLevelType(eventType) ||
              isCompensationType(eventType) ? (
                <span className="text-destructive"> *</span>
              ) : (
                " (اختیاری)"
              )}
            </span>
            <Input
              value={employmentId}
              onChange={(e) => setEmploymentId(e.target.value)}
              dir="ltr"
              autoComplete="off"
              required={
                isTerminationType(eventType) ||
                isTransferType(eventType) ||
                isJobLevelType(eventType) ||
                isCompensationType(eventType)
              }
              aria-required={
                isTerminationType(eventType) ||
                isTransferType(eventType) ||
                isJobLevelType(eventType) ||
                isCompensationType(eventType)
                  ? true
                  : undefined
              }
            />
          </label>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-label-medium">رویداد</legend>
          <label className="block space-y-1">
            <span className="text-label-medium" id={`${formId}-event-type`}>
              نوع رویداد <span className="text-destructive">*</span>
            </span>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={eventType}
              onChange={(e) => {
                setEventType(e.target.value);
                setPreferredApprovalId("");
                setDirty(true);
              }}
              required
              aria-labelledby={`${formId}-event-type`}
            >
              {EVENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.labelFa}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-1">
            <span className="text-label-medium">
              تاریخ مؤثر <span className="text-destructive">*</span>
            </span>
            <p className="text-xs text-muted-foreground">
              متمایز از زمان ثبت/نهایی‌سازی — فقط روز تقویمی.
            </p>
            <JalaliDatePicker
              aria-label="تاریخ مؤثر"
              value={effectiveDate || undefined}
              onChange={(v) => {
                setEffectiveDate(v ?? "");
                setDirty(true);
              }}
            />
          </div>
        </fieldset>

        {isStartReturnType(eventType) ? (
          <fieldset className="space-y-3">
            <legend className="text-label-medium">
              واقعیت‌های حداقل شروع/بازگشت
            </legend>
            <label className="block space-y-1">
              <span className="text-label-medium" id={`${formId}-collab`}>
                نوع همکاری <span className="text-destructive">*</span>
              </span>
              <Input
                value={collaborationType}
                onChange={(e) => {
                  setCollaborationType(e.target.value);
                  setDirty(true);
                }}
                required
                dir="ltr"
                aria-labelledby={`${formId}-collab`}
                autoComplete="off"
              />
            </label>
            {(
              [
                ["teamId", "شناسه تیم", teamId, setTeamId],
                [
                  "organizationalRoleId",
                  "شناسه نقش سازمانی",
                  organizationalRoleId,
                  setOrganizationalRoleId,
                ],
                ["jobTitleId", "شناسه عنوان شغلی", jobTitleId, setJobTitleId],
                ["ladderId", "شناسه لدر", ladderId, setLadderId],
                ["gradeId", "شناسه گرید", gradeId, setGradeId],
                ["seniorityId", "شناسه ارشدیت (اختیاری)", seniorityId, setSeniorityId],
              ] as const
            ).map(([key, label, value, setter]) => (
              <label key={key} className="block space-y-1">
                <span className="text-label-medium" id={`${formId}-${key}`}>
                  {label}
                  {key !== "seniorityId" ? (
                    <span className="text-destructive"> *</span>
                  ) : null}
                </span>
                <Input
                  value={value}
                  onChange={(e) => {
                    setter(e.target.value);
                    setDirty(true);
                  }}
                  required={key !== "seniorityId"}
                  dir="ltr"
                  aria-labelledby={`${formId}-${key}`}
                  autoComplete="off"
                />
              </label>
            ))}
            <HeadcountCapacityPanel
              used={capacityQuery.data?.used ?? 0}
              reserved={capacityQuery.data?.reserved ?? 0}
              free={capacityQuery.data?.free ?? 0}
              exempt={capacityQuery.data?.exempt ?? 0}
              overridden={capacityQuery.data?.overridden ?? 0}
              slotFound={
                capacityQuery.isFetched
                  ? Boolean(capacityQuery.data?.slotId) ||
                    (capacityQuery.data?.exempt ?? 0) > 0
                  : true
              }
              loading={capacityQuery.isFetching}
              errorFa={
                capacityQuery.isError
                  ? "خواندن ظرفیت ناموفق بود."
                  : null
              }
            />
            {compatibleApprovalsQuery.data?.length ? (
              <label className="block space-y-1">
                <span
                  className="text-label-medium"
                  id={`${formId}-pref-apr-sr`}
                >
                  مجوز ظرفیت (پیش‌فرض: قدیمی‌ترین سازگار)
                </span>
                <select
                  aria-labelledby={`${formId}-pref-apr-sr`}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  value={preferredApprovalId}
                  onChange={(e) => {
                    setPreferredApprovalId(e.target.value);
                    setDirty(true);
                  }}
                >
                  <option value="">پیش‌فرض خودکار</option>
                  {compatibleApprovalsQuery.data.map((c, i) => (
                    <option key={c.approvalId} value={c.approvalId}>
                      {i === 0 ? "★ " : ""}
                      {c.approvalId.slice(0, 8)}… (آزاد: {c.freeUnits})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </fieldset>
        ) : null}

        {isTerminationType(eventType) ? (
          <fieldset className="space-y-3">
            <legend className="text-label-medium">
              واقعیت‌های حداقل خاتمه همکاری
            </legend>
            <p className="text-xs text-muted-foreground">
              شناسه همکاری باز را بالا وارد کنید. دلیل خاتمه باید کد کوتاه باشد
              (مثلاً contract_ended) — نه متن آزاد حساس.
            </p>
            <label className="block space-y-1">
              <span
                className="text-label-medium"
                id={`${formId}-termination-reason`}
              >
                کد دلیل خاتمه <span className="text-destructive">*</span>
              </span>
              <Input
                value={terminationReason}
                onChange={(e) => {
                  setTerminationReason(e.target.value);
                  setDirty(true);
                }}
                required
                dir="ltr"
                aria-labelledby={`${formId}-termination-reason`}
                aria-describedby={`${formId}-termination-reason-hint`}
                autoComplete="off"
                placeholder="contract_ended"
              />
              <span
                id={`${formId}-termination-reason-hint`}
                className="text-xs text-muted-foreground"
              >
                نمونه‌ها: contract_ended، resignation، dismissal
              </span>
            </label>
          </fieldset>
        ) : null}

        {isTransferType(eventType) ? (
          <fieldset className="space-y-3">
            <legend className="text-label-medium">
              واقعیت‌های انتقال (مقصد)
            </legend>
            <p className="text-xs text-muted-foreground">
              شناسه همکاری باز را بالا وارد کنید. مقصد باید با انتصاب اولیه فعلی
              متفاوت باشد. ظرفیت مقصد قبل از نهایی‌سازی نمایش داده می‌شود.
            </p>
            {sourcePrimaryQuery.isFetching ? (
              <p className="text-sm text-muted-foreground" role="status">
                در حال بارگذاری انتصاب اولیه مبدأ…
              </p>
            ) : sourcePrimaryQuery.data ? (
              <div
                className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                role="region"
                aria-label="خلاصه انتصاب اولیه مبدأ"
              >
                <p className="text-label-medium mb-2">انتصاب اولیه فعلی (مبدأ)</p>
                <dl className="grid gap-1 text-xs">
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground shrink-0">تیم</dt>
                    <dd className="font-mono truncate" dir="ltr">
                      {sourcePrimaryQuery.data.teamId}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground shrink-0">عنوان</dt>
                    <dd className="font-mono truncate" dir="ltr">
                      {sourcePrimaryQuery.data.jobTitleId}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground shrink-0">لدر / گرید</dt>
                    <dd className="font-mono truncate" dir="ltr">
                      {sourcePrimaryQuery.data.ladderId.slice(0, 8)}… /{" "}
                      {sourcePrimaryQuery.data.gradeId.slice(0, 8)}…
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground shrink-0">شروع</dt>
                    <dd className="tabular-nums" dir="ltr">
                      {sourcePrimaryQuery.data.startDate}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : employmentId.trim() &&
              /^[0-9a-f-]{36}$/i.test(employmentId.trim()) ? (
              <p className="text-sm text-muted-foreground" role="status">
                انتصاب اولیه مبدأ برای این همکاری در تاریخ مؤثر یافت نشد.
              </p>
            ) : null}
            {(
              [
                ["teamId", "شناسه تیم مقصد", teamId, setTeamId],
                [
                  "organizationalRoleId",
                  "شناسه نقش سازمانی مقصد",
                  organizationalRoleId,
                  setOrganizationalRoleId,
                ],
                [
                  "jobTitleId",
                  "شناسه عنوان شغلی مقصد",
                  jobTitleId,
                  setJobTitleId,
                ],
                ["ladderId", "شناسه لدر مقصد", ladderId, setLadderId],
                ["gradeId", "شناسه گرید مقصد", gradeId, setGradeId],
                [
                  "seniorityId",
                  "شناسه ارشدیت مقصد (اختیاری)",
                  seniorityId,
                  setSeniorityId,
                ],
              ] as const
            ).map(([key, label, value, setter]) => (
              <label key={key} className="block space-y-1">
                <span className="text-label-medium" id={`${formId}-xfer-${key}`}>
                  {label}
                  {key !== "seniorityId" ? (
                    <span className="text-destructive"> *</span>
                  ) : null}
                </span>
                <Input
                  value={value}
                  onChange={(e) => {
                    setter(e.target.value);
                    setDirty(true);
                  }}
                  required={key !== "seniorityId"}
                  dir="ltr"
                  aria-labelledby={`${formId}-xfer-${key}`}
                  autoComplete="off"
                />
              </label>
            ))}
            <HeadcountCapacityPanel
              used={capacityQuery.data?.used ?? 0}
              reserved={capacityQuery.data?.reserved ?? 0}
              free={capacityQuery.data?.free ?? 0}
              exempt={capacityQuery.data?.exempt ?? 0}
              overridden={capacityQuery.data?.overridden ?? 0}
              slotFound={
                capacityQuery.isFetched
                  ? Boolean(capacityQuery.data?.slotId) ||
                    (capacityQuery.data?.exempt ?? 0) > 0
                  : true
              }
              loading={capacityQuery.isFetching}
              errorFa={
                capacityQuery.isError
                  ? "خواندن ظرفیت مقصد ناموفق بود."
                  : null
              }
            />
            {compatibleApprovalsQuery.data?.length ? (
              <label className="block space-y-1">
                <span className="text-label-medium" id={`${formId}-pref-apr`}>
                  مجوز ظرفیت (پیش‌فرض: قدیمی‌ترین سازگار)
                </span>
                <select
                  aria-labelledby={`${formId}-pref-apr`}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  value={preferredApprovalId}
                  onChange={(e) => {
                    setPreferredApprovalId(e.target.value);
                    setDirty(true);
                  }}
                >
                  <option value="">پیش‌فرض خودکار</option>
                  {compatibleApprovalsQuery.data.map((c, i) => (
                    <option key={c.approvalId} value={c.approvalId}>
                      {i === 0 ? "★ " : ""}
                      {c.approvalId.slice(0, 8)}… (آزاد: {c.freeUnits})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </fieldset>
        ) : null}

        {isJobLevelType(eventType) ? (
          <fieldset className="space-y-3">
            <legend className="text-label-medium">
              تغییر واقعیت‌های شغلی / سطحی
            </legend>
            <p className="text-xs text-muted-foreground">
              تیم ثابت می‌ماند. برای جابه‌جایی تیم از TransferRecorded استفاده
              کنید. ارتقا فقط نتیجه نهایی گرید (± لدر) است — بدون گردش درخواست.
            </p>
            {sourcePrimaryQuery.data ? (
              <div
                className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                role="region"
                aria-label="خلاصه انتصاب اولیه فعلی"
              >
                <p className="text-label-medium mb-2">انتصاب اولیه فعلی</p>
                <dl className="grid gap-1 text-xs">
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground shrink-0">تیم</dt>
                    <dd className="font-mono truncate" dir="ltr">
                      {sourcePrimaryQuery.data.teamId}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground shrink-0">عنوان</dt>
                    <dd className="font-mono truncate" dir="ltr">
                      {sourcePrimaryQuery.data.jobTitleId}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground shrink-0">لدر / گرید</dt>
                    <dd className="font-mono truncate" dir="ltr">
                      {sourcePrimaryQuery.data.ladderId.slice(0, 8)}… /{" "}
                      {sourcePrimaryQuery.data.gradeId.slice(0, 8)}…
                    </dd>
                  </div>
                </dl>
              </div>
            ) : null}
            {eventType === "OrganizationalRoleChanged" ? (
              <label className="block space-y-1">
                <span className="text-label-medium">شناسه نقش سازمانی جدید</span>
                <Input
                  value={organizationalRoleId}
                  onChange={(e) => {
                    setOrganizationalRoleId(e.target.value);
                    setDirty(true);
                  }}
                  required
                  dir="ltr"
                  autoComplete="off"
                />
              </label>
            ) : null}
            {eventType === "JobTitleChanged" ? (
              <label className="block space-y-1">
                <span className="text-label-medium">شناسه عنوان شغلی جدید</span>
                <Input
                  value={jobTitleId}
                  onChange={(e) => {
                    setJobTitleId(e.target.value);
                    setDirty(true);
                  }}
                  required
                  dir="ltr"
                  autoComplete="off"
                />
              </label>
            ) : null}
            {eventType === "SeniorityChanged" ? (
              <div className="space-y-3">
                <label className="block space-y-1">
                  <span className="text-label-medium">شناسه ارشدیت جدید</span>
                  <Input
                    value={seniorityId}
                    onChange={(e) => {
                      setSeniorityId(e.target.value);
                      if (e.target.value.trim()) setClearSeniority(false);
                      setDirty(true);
                    }}
                    disabled={clearSeniority}
                    dir="ltr"
                    autoComplete="off"
                    aria-describedby={`${formId}-seniority-hint`}
                  />
                  <span
                    id={`${formId}-seniority-hint`}
                    className="text-xs text-muted-foreground"
                  >
                    مقدار را وارد کنید یا پاک‌کردن صریح را علامت بزنید؛ خالیِ
                    دست‌نخورده پذیرفته نمی‌شود.
                  </span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={clearSeniority}
                    onChange={(e) => {
                      setClearSeniority(e.target.checked);
                      if (e.target.checked) setSeniorityId("");
                      setDirty(true);
                    }}
                  />
                  پاک‌کردن ارشدیت (null)
                </label>
              </div>
            ) : null}
            {eventType === "LadderChanged" ||
            eventType === "GradeChanged" ||
            eventType === "PromotionRecorded" ? (
              <>
                {(eventType === "LadderChanged" ||
                  eventType === "PromotionRecorded") && (
                  <label className="block space-y-1">
                    <span className="text-label-medium">
                      شناسه لدر
                      {eventType === "LadderChanged" ? " جدید" : " (اختیاری)"}
                    </span>
                    <Input
                      value={ladderId}
                      onChange={(e) => {
                        setLadderId(e.target.value);
                        setDirty(true);
                      }}
                      required={eventType === "LadderChanged"}
                      dir="ltr"
                      autoComplete="off"
                    />
                  </label>
                )}
                <label className="block space-y-1">
                  <span className="text-label-medium">شناسه گرید جدید</span>
                  <Input
                    value={gradeId}
                    onChange={(e) => {
                      setGradeId(e.target.value);
                      setDirty(true);
                    }}
                    required
                    dir="ltr"
                    autoComplete="off"
                  />
                </label>
              </>
            ) : null}
            {isJobCapacityType(eventType) ? (
              <>
                <HeadcountCapacityPanel
                  used={capacityQuery.data?.used ?? 0}
                  reserved={capacityQuery.data?.reserved ?? 0}
                  free={capacityQuery.data?.free ?? 0}
                  exempt={capacityQuery.data?.exempt ?? 0}
              overridden={capacityQuery.data?.overridden ?? 0}
                  slotFound={
                    capacityQuery.isFetched
                      ? Boolean(capacityQuery.data?.slotId) ||
                        (capacityQuery.data?.exempt ?? 0) > 0
                      : true
                  }
                  loading={capacityQuery.isFetching}
                  errorFa={
                    capacityQuery.isError
                      ? "خواندن ظرفیت ناموفق بود."
                      : null
                  }
                />
                {compatibleApprovalsQuery.data?.length ? (
                  <label className="block space-y-1">
                    <span
                      className="text-label-medium"
                      id={`${formId}-job-pref-apr`}
                    >
                      مجوز ظرفیت (پیش‌فرض: قدیمی‌ترین سازگار)
                    </span>
                    <select
                      aria-labelledby={`${formId}-job-pref-apr`}
                      className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                      value={preferredApprovalId}
                      onChange={(e) => {
                        setPreferredApprovalId(e.target.value);
                        setDirty(true);
                      }}
                    >
                      <option value="">پیش‌فرض خودکار</option>
                      {compatibleApprovalsQuery.data.map((c, i) => (
                        <option key={c.approvalId} value={c.approvalId}>
                          {i === 0 ? "★ " : ""}
                          {c.approvalId.slice(0, 8)}… (آزاد: {c.freeUnits})
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </>
            ) : null}
          </fieldset>
        ) : null}

        {isCompensationType(eventType) ? (
          <fieldset className="space-y-3">
            <legend className="text-label-medium">
              {eventType === "CompensationChanged"
                ? "تغییر جبران‌خدمت"
                : "تغییر قرارداد"}
            </legend>
            <p className="text-xs text-muted-foreground">
              مبلغ هرگز در payload پیش‌نویس ذخیره نمی‌شود — کانال حساس جداگانه.
              نهایی‌سازی نیازمند مجوز compensation.write است.
            </p>
            {eventType === "CompensationChanged" ? (
              <>
                {showCompField("compensation.amount") ? (
                  <label className="block space-y-1">
                    <span className="text-label-medium">
                      مبلغ <span className="text-destructive">*</span>
                    </span>
                    <Input
                      value={compensationAmount}
                      onChange={(e) => {
                        setCompensationAmount(e.target.value);
                        setDirty(true);
                      }}
                      required
                      dir="ltr"
                      inputMode="decimal"
                      autoComplete="off"
                      aria-describedby={`${formId}-amount-hint`}
                    />
                    <span
                      id={`${formId}-amount-hint`}
                      className="text-xs text-muted-foreground"
                    >
                      فقط در کانال حساس؛ کلید amount در payload مجاز نیست.
                    </span>
                  </label>
                ) : null}
                {showCompField("compensation.currency") ? (
                  <label className="block space-y-1">
                    <span className="text-label-medium">کد ارز</span>
                    <Input
                      value={currency}
                      onChange={(e) => {
                        setCurrency(e.target.value);
                        setDirty(true);
                      }}
                      dir="ltr"
                      autoComplete="off"
                    />
                  </label>
                ) : null}
                {showCompField("compensation.change_type") ? (
                  <label className="block space-y-1">
                    <span className="text-label-medium">نوع تغییر</span>
                    <Input
                      value={changeType}
                      onChange={(e) => {
                        setChangeType(e.target.value);
                        setDirty(true);
                      }}
                      dir="ltr"
                      autoComplete="off"
                    />
                  </label>
                ) : null}
                {!showCompField("compensation.amount") &&
                !showCompField("compensation.currency") &&
                !showCompField("compensation.change_type") ? (
                  <p className="text-xs text-muted-foreground">
                    هیچ فیلد جبران‌خدمت در دیکشنری داده فعال نیست.
                  </p>
                ) : null}
              </>
            ) : (
              <>
                {showCompField("contract.contract_type") ? (
                  <label className="block space-y-1">
                    <span className="text-label-medium">نوع قرارداد</span>
                    <Input
                      value={contractType}
                      onChange={(e) => {
                        setContractType(e.target.value);
                        setDirty(true);
                      }}
                      dir="ltr"
                      autoComplete="off"
                    />
                  </label>
                ) : null}
                {showCompField("contract.collaboration_type") ? (
                  <label className="block space-y-1">
                    <span className="text-label-medium">نوع همکاری</span>
                    <Input
                      value={collaborationType}
                      onChange={(e) => {
                        setCollaborationType(e.target.value);
                        setDirty(true);
                      }}
                      dir="ltr"
                      autoComplete="off"
                    />
                  </label>
                ) : null}
                {!showCompField("contract.contract_type") &&
                !showCompField("contract.collaboration_type") ? (
                  <p className="text-xs text-muted-foreground">
                    فیلدهای قرارداد فعال در دیکشنری یافت نشد.
                  </p>
                ) : null}
              </>
            )}
          </fieldset>
        ) : null}

        {activeConflicts.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-label-medium">تعارض‌ها</h3>
            <ConflictList conflicts={activeConflicts} />
            {warningsNeedingAck.map((w) => (
              <label
                key={w.code}
                className="flex items-start gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={ackCodes.has(w.code)}
                  onChange={(e) => {
                    setAckCodes((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(w.code);
                      else next.delete(w.code);
                      return next;
                    });
                  }}
                  aria-describedby={`${formId}-ack-${w.code}`}
                />
                <span id={`${formId}-ack-${w.code}`}>
                  پیامد را می‌پذیرم: {w.messageFa}
                </span>
              </label>
            ))}
            {needsOverride ? (
              <label className="block space-y-1">
                <span className="text-label-medium" id={`${formId}-override`}>
                  دلیل Override (فقط HR Admin){" "}
                  <span className="text-destructive">*</span>
                </span>
                {hasScheduledException ? (
                  <div className="mb-2">
                    <StatusBadge status="Exception" />
                  </div>
                ) : null}
                <Input
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  aria-labelledby={`${formId}-override`}
                  aria-required
                  autoComplete="off"
                />
                <span className="text-xs text-muted-foreground">
                  ظرفیت یا محدودیت دیگر نیازمند تأیید صریح و ثبت ممیزی است.
                </span>
              </label>
            ) : null}
          </div>
        ) : null}

        {errorMsg ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMsg}
          </p>
        ) : null}
        {statusMsg ? (
          <p role="status" className="text-sm text-muted-foreground">
            {statusMsg}
          </p>
        ) : null}

        <footer
          className={cn(
            "flex flex-wrap items-center gap-2 border-t border-border pt-4",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              const cleared = emptySnapshot();
              applySnapshot(cleared);
              lastSavedRef.current = cleared;
              setDirty(false);
              setConflicts([]);
              setErrorMsg(null);
              setStatusMsg(null);
              setDemoDraftOpen(false);
            }}
          >
            انصراف
          </Button>
          <Button
            type="submit"
            variant="secondary"
            disabled={createMut.isPending || updateMut.isPending}
          >
            ذخیره پیش‌نویس
          </Button>
          {draftId ? (
            <Button
              type="button"
              variant="outline"
              disabled={deleteMut.isPending}
              onClick={() => void onDelete()}
            >
              حذف پیش‌نویس
            </Button>
          ) : null}
          <Button
            type="button"
            variant="primary"
            disabled={!draftId || isFinalizeBlockedByAuthzChange}
            onClick={() => {
              setConfirmOpen(true);
            }}
          >
            نهایی‌سازی
          </Button>
        </footer>
      </form>

      {personId.trim() ? (
        <section
          className="space-y-3 border-t border-border pt-6"
          aria-labelledby={`${formId}-events`}
        >
          <h3 id={`${formId}-events`} className="text-label-medium">
            رویدادهای معتبر (نمایش وضعیت حل‌شده)
          </h3>
          <p className="text-xs text-muted-foreground">
            زمان‌بندی‌شده تا تاریخ مؤثر وضعیت فعلی را تغییر نمی‌دهد. جدول زمانی
            کامل در Epic ۵.۳.
          </p>
          {eventsQuery.isLoading ? (
            <p role="status">در حال بارگذاری…</p>
          ) : eventsQuery.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {eventsQuery.error.message || "بارگذاری رویدادها ناموفق بود."}
            </p>
          ) : (eventsQuery.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">رویدادی ثبت نشده است.</p>
          ) : (
            <ul className="space-y-3" role="list">
              {eventsQuery.data?.map((row) => {
                const badge: StatusBadgeKind = isStatusBadgeKind(
                  row.resolvedStatus,
                )
                  ? row.resolvedStatus
                  : "Effective";
                const chainHint = formatChainLinksFa(row.links);
                const showCancel =
                  canCancel && row.resolvedStatus === "Scheduled";
                const showReverse =
                  canReverse && row.resolvedStatus === "Effective";
                const showCorrect =
                  canCorrect &&
                  (row.resolvedStatus === "Scheduled" ||
                    row.resolvedStatus === "Effective");
                return (
                  <li
                    key={row.event.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={badge} />
                        <span className="text-sm font-medium" dir="ltr">
                          {row.event.eventType}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground" dir="ltr">
                        {row.event.id.slice(0, 8)}… · مؤثر{" "}
                        {row.event.effectiveDate}
                      </p>
                      {chainHint ? (
                        <p className="text-xs text-muted-foreground">
                          زنجیره: {chainHint}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {showCancel ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isMutationBlockedByAuthzChange}
                          onClick={() => openLifecycle("cancel", row.event.id)}
                        >
                          لغو
                        </Button>
                      ) : null}
                      {showReverse ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isMutationBlockedByAuthzChange}
                          onClick={() => openLifecycle("reverse", row.event.id)}
                        >
                          بازگشت
                        </Button>
                      ) : null}
                      {showCorrect ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isMutationBlockedByAuthzChange}
                          onClick={() => openLifecycle("correct", row.event.id)}
                        >
                          اصلاح
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      <SensitiveConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={
          isTerminationType(eventType)
            ? "تأیید خاتمه همکاری"
            : isCompensationType(eventType)
              ? "تأیید تغییر جبران‌خدمت / قرارداد"
              : "تأیید نهایی‌سازی رویداد"
        }
        consequence={
          <div className="space-y-2">
            {isTerminationType(eventType) ? (
              <p>
                با تأیید، همکاری و انتصاب‌های باز در تاریخ مؤثر بسته می‌شوند و
                ظرفیت آزاد می‌گردد. این عمل از مسیر رویداد ثبت می‌شود و قابل
                ویرایش مستقیم نیست.
              </p>
            ) : isCompensationType(eventType) ? (
              <p>
                با تأیید، واقعیت جبران‌خدمت/قرارداد در تاریخ مؤثر بسته و باز می‌شود.
                مبلغ از کانال حساس اعمال می‌شود و در payload رویداد نمی‌آید.
              </p>
            ) : (
              <p>
                با تأیید، یک رویداد معتبر در دفتر رویداد ثبت می‌شود و قابل ویرایش
                یا حذف مستقیم نیست.
              </p>
            )}
            <p className="text-muted-foreground">
              تاریخ مؤثر: {effectiveDate || "—"} · نوع: {eventType}
              {isTerminationType(eventType)
                ? ` · دلیل: ${terminationReason || "—"}`
                : ""}
            </p>
            {evaluateQuery.isLoading ? (
              <p role="status">در حال بررسی تعارض‌ها…</p>
            ) : (
              <ConflictList conflicts={activeConflicts} />
            )}
          </div>
        }
        confirmDisabled={
          finalizeBlocked ||
          finalizeMut.isPending ||
          evaluateQuery.isLoading ||
          evaluateQuery.isError
        }
        blockedReason={
          isFinalizeBlockedByAuthzChange
            ? "نهایی‌سازی تا تأیید تغییر دسترسی ممکن نیست."
            : blocking
              ? "تعارض مسدودکننده وجود دارد."
              : !ackComplete
                ? "تأیید هشدارها الزامی است."
                : isGoldCtaBlocked
                  ? "وضعیت کهنه یا بازمحاسبه مانع نهایی‌سازی است."
                  : undefined
        }
        busy={finalizeMut.isPending}
        onConfirm={onFinalizeConfirm}
      />

      <SensitiveConfirmationDialog
        open={Boolean(lifecycleOp && lifecycleEventId)}
        onOpenChange={(open) => {
          if (!open) {
            setLifecycleOp(null);
            setLifecycleEventId(null);
            setLifecycleReason("");
          }
        }}
        title={lifecycleTitle}
        confirmLabel="ثبت"
        consequence={
          <div className="space-y-2">
            <p>
              این رویداد تاریخچه را پاک نمی‌کند؛ اصلاح مرتبط ثبت می‌شود.
            </p>
            <p className="text-muted-foreground" dir="ltr">
              هدف: {lifecycleEventId}
            </p>
          </div>
        }
        reasonRequired
        reason={lifecycleReason}
        onReasonChange={setLifecycleReason}
        confirmDisabled={isMutationBlockedByAuthzChange || lifecycleBusy}
        blockedReason={
          isMutationBlockedByAuthzChange
            ? "عملیات تا تأیید تغییر دسترسی ممکن نیست."
            : undefined
        }
        busy={lifecycleBusy}
        onConfirm={onLifecycleConfirm}
      />
    </section>
  );
}
