"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  EntityPicker,
  TechnicalDetailDisclosure,
  createEmploymentSearch,
  createGradeSearch,
  createJobTitleSearch,
  createLadderSearch,
  createOrgUnitSearch,
  createOrganizationalRoleSearch,
  createPersonSearch,
  createPrimaryAssignmentSearch,
  createSenioritySearch,
  useEntityPickerCascade,
  type EntityPickerValue,
} from "@/components/entity-picker";
import {
  FormField,
  FormFooter,
  FormLayout,
  FormSection,
} from "@/components/form-layout";
import { Panel } from "@/components/layout/panel-section";
import { JalaliDatePicker } from "@/components/jalali-date-picker";
import {
  useLeaveGuardOptional,
  useLeaveGuardRegistration,
} from "@/components/leave-guard";
import {
  employmentIdForPrimaryAssignment,
  entityId,
  formatCodeName,
  fromEntitySnap,
  hydrateEmploymentValue,
  hydratePersonValue,
  toEntitySnap,
  type EntitySnap,
} from "@/components/personnel/personnel-event-entity-helpers";
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
import { RowActionCluster } from "@/components/ui/row-action-overflow";
import { usePlatformStatus } from "@/components/platform-status-provider";
import {
  EVENT_TYPE_OPTIONS,
  formatChainLinksFa,
} from "@/lib/personnel-event-timeline";
import { api } from "@/lib/trpc/client";
import { Ban, Pencil, Undo2 } from "lucide-react";

type Conflict = {
  code: string;
  severity: "blocking" | "warning";
  messageFa: string;
  requiresAck?: boolean;
  requiresOverride?: boolean;
};

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

type PersonnelEventFormProps = {
  /** Prefill from `/personnel-events/register?person=` (Story 4b.7). */
  initialPersonId?: string;
};

type SourceQueryState = {
  isError: boolean;
  isPending: boolean;
  isFetching: boolean;
};

/** Human source label, or loading / error / empty — never a perpetual ambiguous «…» on failure. */
function resolveSourceLabel(
  label: string | null,
  query: SourceQueryState,
): string {
  if (label) return label;
  if (query.isError) return "بارگذاری ناموفق";
  if (query.isPending || query.isFetching) return "…";
  return "—";
}

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

  const [person, setPerson] = React.useState<EntityPickerValue>(null);
  const [employment, setEmployment] = React.useState<EntityPickerValue>(null);
  const [primaryAssignment, setPrimaryAssignment] =
    React.useState<EntityPickerValue>(null);
  const [eventType, setEventType] = React.useState("ScaffoldChangeRecorded");
  const [effectiveDate, setEffectiveDate] = React.useState("");
  const [collaborationType, setCollaborationType] = React.useState("employee");
  const [team, setTeam] = React.useState<EntityPickerValue>(null);
  const [organizationalRole, setOrganizationalRole] =
    React.useState<EntityPickerValue>(null);
  const [jobTitle, setJobTitle] = React.useState<EntityPickerValue>(null);
  const [ladder, setLadder] = React.useState<EntityPickerValue>(null);
  const [grade, setGrade] = React.useState<EntityPickerValue>(null);
  const [seniority, setSeniority] = React.useState<EntityPickerValue>(null);
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

  const personId = entityId(person);
  const employmentId = entityId(employment);
  const teamId = entityId(team);
  const organizationalRoleId = entityId(organizationalRole);
  const jobTitleId = entityId(jobTitle);
  const ladderId = entityId(ladder);
  const gradeId = entityId(grade);
  const seniorityId = entityId(seniority);

  const personSearch = React.useMemo(() => createPersonSearch(), []);
  const orgUnitSearch = React.useMemo(() => createOrgUnitSearch(), []);
  const roleSearch = React.useMemo(
    () => createOrganizationalRoleSearch(),
    [],
  );
  const jobTitleSearch = React.useMemo(() => createJobTitleSearch(), []);
  const ladderSearch = React.useMemo(() => createLadderSearch(), []);
  const senioritySearch = React.useMemo(() => createSenioritySearch(), []);
  const employmentSearch = React.useMemo(
    () => createEmploymentSearch(person?.id ?? null),
    [person?.id],
  );
  const primaryAssignmentSearch = React.useMemo(
    () => createPrimaryAssignmentSearch(person?.id ?? null),
    [person?.id],
  );
  const gradeSearch = React.useMemo(
    () => createGradeSearch(ladder?.id ?? null),
    [ladder?.id],
  );

  const syncingEmploymentFromPa = React.useRef(false);
  const paSyncGenRef = React.useRef(0);
  const inboundHydrateGenRef = React.useRef(0);
  const personRef = React.useRef(person);
  const primaryAssignmentRef = React.useRef(primaryAssignment);
  personRef.current = person;
  primaryAssignmentRef.current = primaryAssignment;

  const employmentCascade = useEntityPickerCascade(person, "فرد", {
    value: employment,
    onValueChange: (next) => {
      setEmployment(next);
      if (!syncingEmploymentFromPa.current) {
        setPrimaryAssignment(null);
      }
    },
  });
  const primaryAssignmentCascade = useEntityPickerCascade(person, "فرد", {
    value: primaryAssignment,
    onValueChange: setPrimaryAssignment,
  });
  const gradeCascade = useEntityPickerCascade(ladder, "لدر", {
    value: grade,
    onValueChange: setGrade,
  });

  const onPersonChange = React.useCallback((next: EntityPickerValue) => {
    inboundHydrateGenRef.current += 1;
    setPerson(next);
    setDirty(true);
  }, []);

  const onEmploymentChange = React.useCallback(
    (next: EntityPickerValue) => {
      employmentCascade.onValueChange(next);
      setDirty(true);
    },
    [employmentCascade],
  );

  const onPrimaryAssignmentChange = React.useCallback(
    (next: EntityPickerValue) => {
      primaryAssignmentCascade.onValueChange(next);
      setDirty(true);
      const gen = ++paSyncGenRef.current;
      if (!next || !person?.id) return;
      const pid = person.id;
      const paid = next.id;
      void (async () => {
        const empId = await employmentIdForPrimaryAssignment(pid, paid);
        if (gen !== paSyncGenRef.current) return;
        if (personRef.current?.id !== pid) return;
        if (primaryAssignmentRef.current?.id !== paid) return;
        if (!empId) {
          // Keep PA and employment consistent — drop PA when mapping fails.
          primaryAssignmentCascade.onValueChange(null);
          setErrorMsg(
            "همکاری متناظر با انتصاب اولیه یافت نشد؛ انتصاب پاک شد.",
          );
          return;
        }
        const empValue =
          (await hydrateEmploymentValue(pid, empId)) ??
          ({ id: empId, code: "", labelFa: "همکاری" } satisfies NonNullable<
            EntityPickerValue
          >);
        if (gen !== paSyncGenRef.current) return;
        if (personRef.current?.id !== pid) return;
        if (primaryAssignmentRef.current?.id !== paid) return;
        syncingEmploymentFromPa.current = true;
        employmentCascade.onValueChange(empValue);
        syncingEmploymentFromPa.current = false;
      })();
    },
    [person?.id, primaryAssignmentCascade, employmentCascade],
  );

  const onLadderChange = React.useCallback(
    (next: EntityPickerValue) => {
      setLadder(next);
      setDirty(true);
    },
    [],
  );

  const onGradeChange = React.useCallback(
    (next: EntityPickerValue) => {
      gradeCascade.onValueChange(next);
      setDirty(true);
    },
    [gradeCascade],
  );

  /** Snapshot of last-saved (or initial empty) fields for leave-guard Discard. */
  type FormSnapshot = {
    person: EntitySnap;
    employment: EntitySnap;
    primaryAssignment: EntitySnap;
    eventType: string;
    effectiveDate: string;
    collaborationType: string;
    team: EntitySnap;
    organizationalRole: EntitySnap;
    jobTitle: EntitySnap;
    ladder: EntitySnap;
    grade: EntitySnap;
    seniority: EntitySnap;
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
    person: null,
    employment: null,
    primaryAssignment: null,
    eventType: "ScaffoldChangeRecorded",
    effectiveDate: "",
    collaborationType: "employee",
    team: null,
    organizationalRole: null,
    jobTitle: null,
    ladder: null,
    grade: null,
    seniority: null,
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
    (() => {
      const empty = emptySnapshot();
      const inboundSeed = initialPersonId?.trim() ?? "";
      return inboundSeed
        ? {
            ...empty,
            person: { id: inboundSeed, code: "", labelFa: "پرسنل" },
          }
        : empty;
    })(),
  );

  const applySnapshot = React.useCallback(
    (snap: FormSnapshot) => {
      inboundHydrateGenRef.current += 1;
      paSyncGenRef.current += 1;
      employmentCascade.alignParentId(snap.person?.id ?? null);
      primaryAssignmentCascade.alignParentId(snap.person?.id ?? null);
      gradeCascade.alignParentId(snap.ladder?.id ?? null);
      setPerson(fromEntitySnap(snap.person));
      setEmployment(fromEntitySnap(snap.employment));
      setPrimaryAssignment(fromEntitySnap(snap.primaryAssignment));
      setEventType(snap.eventType);
      setEffectiveDate(snap.effectiveDate);
      setCollaborationType(snap.collaborationType);
      setTeam(fromEntitySnap(snap.team));
      setOrganizationalRole(fromEntitySnap(snap.organizationalRole));
      setJobTitle(fromEntitySnap(snap.jobTitle));
      setLadder(fromEntitySnap(snap.ladder));
      setGrade(fromEntitySnap(snap.grade));
      setSeniority(fromEntitySnap(snap.seniority));
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
    },
    [employmentCascade.alignParentId, primaryAssignmentCascade.alignParentId, gradeCascade.alignParentId],
  );

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

  const approvalLabelsQuery = api.headcount.listApprovals.useQuery(
    capacityTeamId && /^[0-9a-f-]{36}$/i.test(capacityTeamId)
      ? { teamId: capacityTeamId }
      : undefined,
    {
      enabled:
        Boolean(compatibleApprovalsQuery.data?.length) &&
        Boolean(capacityTeamId) &&
        /^[0-9a-f-]{36}$/i.test(capacityTeamId),
    },
  );

  const approvalLabelById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const row of approvalLabelsQuery.data ?? []) {
      const label =
        row.approvalReference?.trim() ||
        row.requirementCode?.trim() ||
        "";
      if (label) map.set(row.id, label);
    }
    return map;
  }, [approvalLabelsQuery.data]);

  function formatApprovalOptionLabel(
    approvalId: string,
    freeUnits: number,
    starred: boolean,
  ): string {
    const human = approvalLabelById.get(approvalId);
    const base = human
      ? `${human} (آزاد: ${freeUnits})`
      : `مجوز ظرفیت (آزاد: ${freeUnits})`;
    return starred ? `★ ${base}` : base;
  }

  const sourceTeamId = sourcePrimaryQuery.data?.teamId ?? "";
  const sourceJobTitleId = sourcePrimaryQuery.data?.jobTitleId ?? "";
  const sourceLadderId = sourcePrimaryQuery.data?.ladderId ?? "";
  const sourceGradeId = sourcePrimaryQuery.data?.gradeId ?? "";

  const sourceTeamQuery = api.organization.get.useQuery(
    { id: sourceTeamId },
    {
      enabled:
        Boolean(sourcePrimaryQuery.data) &&
        /^[0-9a-f-]{36}$/i.test(sourceTeamId),
    },
  );
  const sourceJobTitleQuery = api.jobReference.getJobTitle.useQuery(
    { id: sourceJobTitleId },
    {
      enabled:
        Boolean(sourcePrimaryQuery.data) &&
        /^[0-9a-f-]{36}$/i.test(sourceJobTitleId),
    },
  );
  const sourceLadderQuery = api.jobReference.getLadder.useQuery(
    { id: sourceLadderId },
    {
      enabled:
        Boolean(sourcePrimaryQuery.data) &&
        /^[0-9a-f-]{36}$/i.test(sourceLadderId),
    },
  );
  const sourceGradeQuery = api.jobReference.getGrade.useQuery(
    { id: sourceGradeId },
    {
      enabled:
        Boolean(sourcePrimaryQuery.data) &&
        /^[0-9a-f-]{36}$/i.test(sourceGradeId),
    },
  );

  const sourceTeamLabel = sourceTeamQuery.data
    ? formatCodeName(sourceTeamQuery.data.code, sourceTeamQuery.data.nameFa)
    : null;
  const sourceJobTitleLabel = sourceJobTitleQuery.data
    ? formatCodeName(
        sourceJobTitleQuery.data.code,
        sourceJobTitleQuery.data.nameFa,
      )
    : null;
  const sourceLadderLabel = sourceLadderQuery.data
    ? formatCodeName(
        sourceLadderQuery.data.code,
        sourceLadderQuery.data.nameFa,
      )
    : null;
  const sourceGradeLabel = sourceGradeQuery.data
    ? formatCodeName(sourceGradeQuery.data.code, sourceGradeQuery.data.nameFa)
    : null;
  const sourceTeamDisplay = resolveSourceLabel(sourceTeamLabel, sourceTeamQuery);
  const sourceJobTitleDisplay = resolveSourceLabel(
    sourceJobTitleLabel,
    sourceJobTitleQuery,
  );
  const sourceLadderDisplay = resolveSourceLabel(
    sourceLadderLabel,
    sourceLadderQuery,
  );
  const sourceGradeDisplay = resolveSourceLabel(
    sourceGradeLabel,
    sourceGradeQuery,
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
          setErrorMsg("برای خاتمه، همکاری باز الزامی است.");
          return false;
        }
        if (!terminationReason.trim()) {
          setErrorMsg("برای خاتمه، کد دلیل خاتمه الزامی است.");
          return false;
        }
      }
      if (isTransferType(eventType)) {
        if (!employmentId.trim()) {
          setErrorMsg("برای انتقال، همکاری باز الزامی است.");
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
          setErrorMsg("برای تغییر شغلی، همکاری باز الزامی است.");
          return false;
        }
      }
      if (isCompensationType(eventType)) {
        if (!employmentId.trim()) {
          setErrorMsg("برای تغییر جبران‌خدمت/قرارداد، همکاری الزامی است.");
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
        person: toEntitySnap(person),
        employment: toEntitySnap(employment),
        primaryAssignment: toEntitySnap(primaryAssignment),
        eventType,
        effectiveDate,
        collaborationType,
        team: toEntitySnap(team),
        organizationalRole: toEntitySnap(organizationalRole),
        jobTitle: toEntitySnap(jobTitle),
        ladder: toEntitySnap(ladder),
        grade: toEntitySnap(grade),
        seniority: toEntitySnap(seniority),
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
    person,
    employment,
    primaryAssignment,
    eventType,
    effectiveDate,
    collaborationType,
    team,
    organizationalRole,
    jobTitle,
    ladder,
    grade,
    seniority,
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

  /** Inbound `?person=` while mounted — leave-guard before swap; never silent wipe (AC #8). */
  React.useEffect(() => {
    const inbound = initialPersonId?.trim() ?? "";
    if (inbound === personIdRef.current) return;
    if (inboundReconcileRef.current) return;

    const applyInboundPerson = (id: string) => {
      const gen = ++inboundHydrateGenRef.current;
      if (!id) {
        setPerson(null);
        lastSavedRef.current = { ...lastSavedRef.current, person: null };
        return;
      }
      void hydratePersonValue(id).then((value) => {
        if (gen !== inboundHydrateGenRef.current) return;
        const current = personRef.current;
        // Do not overwrite a different manual selection.
        if (current && current.id !== id) return;
        const token = value ?? { id, code: "", labelFa: "پرسنل" };
        setPerson(token);
        lastSavedRef.current = {
          ...lastSavedRef.current,
          person: toEntitySnap(token),
        };
      });
    };

    if (!dirtyRef.current) {
      queueMicrotask(() => {
        if (inbound === personIdRef.current || dirtyRef.current) return;
        applyInboundPerson(inbound);
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
        applyInboundPerson(inbound);
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
    <FormLayout aria-labelledby={`${formId}-title`}>
      <header className="space-y-1">
        <h2 id={`${formId}-title`} className="text-heading">
          فرم رویداد پرسنلی
        </h2>
        <p className="text-caption text-text-secondary">
          ذخیره پیش‌نویس وضعیت فعلی را تغییر نمی‌دهد. نهایی‌سازی رویداد معتبر
          می‌سازد. لغو/بازگشت/اصلاح اصل را پاک نمی‌کند.
        </p>
      </header>

      <Panel>
      <form
        className="space-y-form-section-gap"
        onSubmit={(e) => {
          e.preventDefault();
          void saveDraft();
        }}
        onChange={() => setDirty(true)}
      >
        <FormSection title="شناسه‌ها">
          <FormField label="فرد" htmlFor={`${formId}-person`} required>
            <EntityPicker
              id={`${formId}-person`}
              search={personSearch}
              value={person}
              onValueChange={onPersonChange}
              scopeNoteFa="جستجو با کد پرسنلی یا نام"
              placeholder="کد یا نام پرسنل…"
              aria-required
            />
          </FormField>
          {person ? (
            <TechnicalDetailDisclosure
              value={person.id}
              valueLabelFa="شناسهٔ فنی فرد"
            />
          ) : null}
          <FormField
            label={
              <>
                همکاری
                {!(
                  isTerminationType(eventType) ||
                  isTransferType(eventType) ||
                  isJobLevelType(eventType) ||
                  isCompensationType(eventType)
                )
                  ? " (اختیاری)"
                  : null}
              </>
            }
            htmlFor={`${formId}-employment`}
            required={
              isTerminationType(eventType) ||
              isTransferType(eventType) ||
              isJobLevelType(eventType) ||
              isCompensationType(eventType)
            }
          >
            <EntityPicker
              id={`${formId}-employment`}
              search={employmentSearch}
              value={employmentCascade.value}
              onValueChange={onEmploymentChange}
              disabled={employmentCascade.disabled}
              disabledReasonFa={employmentCascade.disabledReasonFa}
              scopeNoteFa="سوابق همکاری فرد انتخاب‌شده"
              placeholder="تاریخ یا نوع همکاری…"
              aria-required={
                isTerminationType(eventType) ||
                isTransferType(eventType) ||
                isJobLevelType(eventType) ||
                isCompensationType(eventType)
              }
            />
          </FormField>
          <FormField
            label="انتصاب اولیه"
            htmlFor={`${formId}-primary-assignment`}
            help="انتخاب انتصاب، همکاری متناظر را هماهنگ می‌کند."
          >
            <EntityPicker
              id={`${formId}-primary-assignment`}
              search={primaryAssignmentSearch}
              value={primaryAssignmentCascade.value}
              onValueChange={onPrimaryAssignmentChange}
              disabled={primaryAssignmentCascade.disabled}
              disabledReasonFa={primaryAssignmentCascade.disabledReasonFa}
              scopeNoteFa="انتصاب‌های اولیه فرد انتخاب‌شده"
              placeholder="تیم، عنوان یا تاریخ…"
            />
          </FormField>
        </FormSection>

        <FormSection title="رویداد">
          <FormField label="نوع رویداد" htmlFor={`${formId}-event-type`} required>
            <select
              className="flex h-control-height w-full rounded-md border border-control-border bg-surface px-3 text-body"
              value={eventType}
              onChange={(e) => {
                setEventType(e.target.value);
                setPreferredApprovalId("");
                setDirty(true);
              }}
              required
            >
              {EVENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.labelFa}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            label="تاریخ مؤثر"
            htmlFor={`${formId}-effective-date`}
            required
            help="متمایز از زمان ثبت/نهایی‌سازی — فقط روز تقویمی."
          >
            <JalaliDatePicker
              aria-label="تاریخ مؤثر"
              value={effectiveDate || undefined}
              onChange={(v) => {
                setEffectiveDate(v ?? "");
                setDirty(true);
              }}
            />
          </FormField>
        </FormSection>

        {isStartReturnType(eventType) ? (
          <FormSection title="واقعیت‌های حداقل شروع/بازگشت">
            <FormField label="نوع همکاری" htmlFor={`${formId}-collab`} required>
              <Input
                value={collaborationType}
                onChange={(e) => {
                  setCollaborationType(e.target.value);
                  setDirty(true);
                }}
                required
                dir="ltr"
                autoComplete="off"
              />
            </FormField>
            <FormField label="تیم" htmlFor={`${formId}-team`} required>
              <EntityPicker
                id={`${formId}-team`}
                search={orgUnitSearch}
                value={team}
                onValueChange={(next) => {
                  setTeam(next);
                  setDirty(true);
                }}
                scopeNoteFa="واحدهای سازمانی قابل‌مشاهده"
                placeholder="کد یا نام تیم…"
                aria-required
              />
            </FormField>
            <FormField
              label="نقش سازمانی"
              htmlFor={`${formId}-role`}
              required
            >
              <EntityPicker
                id={`${formId}-role`}
                search={roleSearch}
                value={organizationalRole}
                onValueChange={(next) => {
                  setOrganizationalRole(next);
                  setDirty(true);
                }}
                scopeNoteFa="مراجع نقش سازمانی"
                placeholder="کد یا نام نقش…"
                aria-required
              />
            </FormField>
            <FormField
              label="عنوان شغلی"
              htmlFor={`${formId}-job-title`}
              required
            >
              <EntityPicker
                id={`${formId}-job-title`}
                search={jobTitleSearch}
                value={jobTitle}
                onValueChange={(next) => {
                  setJobTitle(next);
                  setDirty(true);
                }}
                scopeNoteFa="مراجع عنوان شغلی"
                placeholder="کد یا نام عنوان…"
                aria-required
              />
            </FormField>
            <FormField label="لدر" htmlFor={`${formId}-ladder`} required>
              <EntityPicker
                id={`${formId}-ladder`}
                search={ladderSearch}
                value={ladder}
                onValueChange={onLadderChange}
                scopeNoteFa="مراجع لدر"
                placeholder="کد یا نام لدر…"
                aria-required
              />
            </FormField>
            <FormField label="گرید" htmlFor={`${formId}-grade`} required>
              <EntityPicker
                id={`${formId}-grade`}
                search={gradeSearch}
                value={gradeCascade.value}
                onValueChange={onGradeChange}
                disabled={gradeCascade.disabled}
                disabledReasonFa={gradeCascade.disabledReasonFa}
                scopeNoteFa="گریدهای لدر انتخاب‌شده"
                placeholder="کد یا نام گرید…"
                aria-required
              />
            </FormField>
            <FormField
              label="ارشدیت (اختیاری)"
              htmlFor={`${formId}-seniority`}
            >
              <EntityPicker
                id={`${formId}-seniority`}
                search={senioritySearch}
                value={seniority}
                onValueChange={(next) => {
                  setSeniority(next);
                  setDirty(true);
                }}
                scopeNoteFa="مراجع ارشدیت"
                placeholder="کد یا نام ارشدیت…"
              />
            </FormField>
            {team ? (
              <TechnicalDetailDisclosure
                value={team.id}
                valueLabelFa="شناسهٔ فنی تیم"
              />
            ) : null}
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
              <FormField
                label="مجوز ظرفیت (پیش‌فرض: قدیمی‌ترین سازگار)"
                htmlFor={`${formId}-pref-apr-sr`}
              >
                <select
                  className="border-control-border bg-surface h-control-height w-full rounded-md border px-3 text-body"
                  value={preferredApprovalId}
                  onChange={(e) => {
                    setPreferredApprovalId(e.target.value);
                    setDirty(true);
                  }}
                >
                  <option value="">پیش‌فرض خودکار</option>
                  {compatibleApprovalsQuery.data.map((c, i) => (
                    <option key={c.approvalId} value={c.approvalId}>
                      {formatApprovalOptionLabel(
                        c.approvalId,
                        c.freeUnits,
                        i === 0,
                      )}
                    </option>
                  ))}
                </select>
              </FormField>
            ) : null}
          </FormSection>
        ) : null}

        {isTerminationType(eventType) ? (
          <FormSection title="واقعیت‌های حداقل خاتمه همکاری">
            <p className="text-caption text-text-tertiary">
              همکاری باز را بالا انتخاب کنید. دلیل خاتمه باید کد کوتاه باشد
              (مثلاً contract_ended) — نه متن آزاد حساس.
            </p>
            <FormField
              label="کد دلیل خاتمه"
              htmlFor={`${formId}-termination-reason`}
              required
              help="نمونه‌ها: contract_ended، resignation، dismissal"
            >
              <Input
                value={terminationReason}
                onChange={(e) => {
                  setTerminationReason(e.target.value);
                  setDirty(true);
                }}
                required
                dir="ltr"
                autoComplete="off"
                placeholder="contract_ended"
              />
            </FormField>
          </FormSection>
        ) : null}

        {isTransferType(eventType) ? (
          <FormSection title="واقعیت‌های انتقال (مقصد)">
            <p className="text-caption text-text-tertiary">
              همکاری باز را بالا انتخاب کنید. مقصد باید با انتصاب اولیه فعلی
              متفاوت باشد. ظرفیت مقصد قبل از نهایی‌سازی نمایش داده می‌شود.
            </p>
            {sourcePrimaryQuery.isFetching ? (
              <p className="text-body text-text-secondary" role="status">
                در حال بارگذاری انتصاب اولیه مبدأ…
              </p>
            ) : sourcePrimaryQuery.data ? (
              <div
                className="rounded-md border border-hairline bg-surface-subtle px-3 py-2 text-body"
                role="region"
                aria-label="خلاصه انتصاب اولیه مبدأ"
              >
                <p className="text-field-label mb-2">انتصاب اولیه فعلی (مبدأ)</p>
                <dl className="grid gap-1 text-caption">
                  <div className="flex gap-2">
                    <dt className="text-text-tertiary shrink-0">تیم</dt>
                    <dd className="truncate">
                      {sourceTeamDisplay}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-text-tertiary shrink-0">عنوان</dt>
                    <dd className="truncate">
                      {sourceJobTitleDisplay}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-text-tertiary shrink-0">لدر / گرید</dt>
                    <dd className="truncate">
                      {sourceLadderDisplay} / {sourceGradeDisplay}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-text-tertiary shrink-0">شروع</dt>
                    <dd className="tabular-nums" dir="ltr">
                      {sourcePrimaryQuery.data.startDate}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : employmentId.trim() &&
              /^[0-9a-f-]{36}$/i.test(employmentId.trim()) ? (
              <p className="text-body text-text-secondary" role="status">
                انتصاب اولیه مبدأ برای این همکاری در تاریخ مؤثر یافت نشد.
              </p>
            ) : null}
            <FormField label="تیم مقصد" htmlFor={`${formId}-xfer-team`} required>
              <EntityPicker
                id={`${formId}-xfer-team`}
                search={orgUnitSearch}
                value={team}
                onValueChange={(next) => {
                  setTeam(next);
                  setDirty(true);
                }}
                scopeNoteFa="واحدهای سازمانی قابل‌مشاهده"
                placeholder="کد یا نام تیم…"
                aria-required
              />
            </FormField>
            <FormField
              label="نقش سازمانی مقصد"
              htmlFor={`${formId}-xfer-role`}
              required
            >
              <EntityPicker
                id={`${formId}-xfer-role`}
                search={roleSearch}
                value={organizationalRole}
                onValueChange={(next) => {
                  setOrganizationalRole(next);
                  setDirty(true);
                }}
                scopeNoteFa="مراجع نقش سازمانی"
                placeholder="کد یا نام نقش…"
                aria-required
              />
            </FormField>
            <FormField
              label="عنوان شغلی مقصد"
              htmlFor={`${formId}-xfer-job-title`}
              required
            >
              <EntityPicker
                id={`${formId}-xfer-job-title`}
                search={jobTitleSearch}
                value={jobTitle}
                onValueChange={(next) => {
                  setJobTitle(next);
                  setDirty(true);
                }}
                scopeNoteFa="مراجع عنوان شغلی"
                placeholder="کد یا نام عنوان…"
                aria-required
              />
            </FormField>
            <FormField
              label="لدر مقصد"
              htmlFor={`${formId}-xfer-ladder`}
              required
            >
              <EntityPicker
                id={`${formId}-xfer-ladder`}
                search={ladderSearch}
                value={ladder}
                onValueChange={onLadderChange}
                scopeNoteFa="مراجع لدر"
                placeholder="کد یا نام لدر…"
                aria-required
              />
            </FormField>
            <FormField
              label="گرید مقصد"
              htmlFor={`${formId}-xfer-grade`}
              required
            >
              <EntityPicker
                id={`${formId}-xfer-grade`}
                search={gradeSearch}
                value={gradeCascade.value}
                onValueChange={onGradeChange}
                disabled={gradeCascade.disabled}
                disabledReasonFa={gradeCascade.disabledReasonFa}
                scopeNoteFa="گریدهای لدر انتخاب‌شده"
                placeholder="کد یا نام گرید…"
                aria-required
              />
            </FormField>
            <FormField
              label="ارشدیت مقصد (اختیاری)"
              htmlFor={`${formId}-xfer-seniority`}
            >
              <EntityPicker
                id={`${formId}-xfer-seniority`}
                search={senioritySearch}
                value={seniority}
                onValueChange={(next) => {
                  setSeniority(next);
                  setDirty(true);
                }}
                scopeNoteFa="مراجع ارشدیت"
                placeholder="کد یا نام ارشدیت…"
              />
            </FormField>
            {team ? (
              <TechnicalDetailDisclosure
                value={team.id}
                valueLabelFa="شناسهٔ فنی تیم مقصد"
              />
            ) : null}
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
              <FormField
                label="مجوز ظرفیت (پیش‌فرض: قدیمی‌ترین سازگار)"
                htmlFor={`${formId}-pref-apr`}
              >
                <select
                  className="border-control-border bg-surface h-control-height w-full rounded-md border px-3 text-body"
                  value={preferredApprovalId}
                  onChange={(e) => {
                    setPreferredApprovalId(e.target.value);
                    setDirty(true);
                  }}
                >
                  <option value="">پیش‌فرض خودکار</option>
                  {compatibleApprovalsQuery.data.map((c, i) => (
                    <option key={c.approvalId} value={c.approvalId}>
                      {formatApprovalOptionLabel(
                        c.approvalId,
                        c.freeUnits,
                        i === 0,
                      )}
                    </option>
                  ))}
                </select>
              </FormField>
            ) : null}
          </FormSection>
        ) : null}

        {isJobLevelType(eventType) ? (
          <FormSection title="تغییر واقعیت‌های شغلی / سطحی">
            <p className="text-caption text-text-tertiary">
              تیم ثابت می‌ماند. برای جابه‌جایی تیم از TransferRecorded استفاده
              کنید. ارتقا فقط نتیجه نهایی گرید (± لدر) است — بدون گردش درخواست.
            </p>
            {sourcePrimaryQuery.data ? (
              <div
                className="rounded-md border border-hairline bg-surface-subtle px-3 py-2 text-body"
                role="region"
                aria-label="خلاصه انتصاب اولیه فعلی"
              >
                <p className="text-field-label mb-2">انتصاب اولیه فعلی</p>
                <dl className="grid gap-1 text-caption">
                  <div className="flex gap-2">
                    <dt className="text-text-tertiary shrink-0">تیم</dt>
                    <dd className="truncate">{sourceTeamDisplay}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-text-tertiary shrink-0">عنوان</dt>
                    <dd className="truncate">{sourceJobTitleDisplay}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-text-tertiary shrink-0">لدر / گرید</dt>
                    <dd className="truncate">
                      {sourceLadderDisplay} / {sourceGradeDisplay}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : null}
            {eventType === "OrganizationalRoleChanged" ? (
              <FormField
                label="نقش سازمانی جدید"
                htmlFor={`${formId}-auto-field-2`}
                required
              >
                <EntityPicker
                  id={`${formId}-auto-field-2`}
                  search={roleSearch}
                  value={organizationalRole}
                  onValueChange={(next) => {
                    setOrganizationalRole(next);
                    setDirty(true);
                  }}
                  scopeNoteFa="مراجع نقش سازمانی"
                  placeholder="کد یا نام نقش…"
                  aria-required
                />
              </FormField>
            ) : null}
            {eventType === "JobTitleChanged" ? (
              <FormField
                label="عنوان شغلی جدید"
                htmlFor={`${formId}-auto-field-3`}
                required
              >
                <EntityPicker
                  id={`${formId}-auto-field-3`}
                  search={jobTitleSearch}
                  value={jobTitle}
                  onValueChange={(next) => {
                    setJobTitle(next);
                    setDirty(true);
                  }}
                  scopeNoteFa="مراجع عنوان شغلی"
                  placeholder="کد یا نام عنوان…"
                  aria-required
                />
              </FormField>
            ) : null}
            {eventType === "SeniorityChanged" ? (
              <div className="space-y-3">
                <FormField
                  label="ارشدیت جدید"
                  htmlFor={`${formId}-seniority`}
                  help="مقدار را انتخاب کنید یا پاک‌کردن صریح را علامت بزنید؛ خالیِ دست‌نخورده پذیرفته نمی‌شود."
                >
                  <EntityPicker
                    id={`${formId}-seniority`}
                    search={senioritySearch}
                    value={seniority}
                    onValueChange={(next) => {
                      setSeniority(next);
                      if (next) setClearSeniority(false);
                      setDirty(true);
                    }}
                    disabled={clearSeniority}
                    disabledReasonFa={
                      clearSeniority
                        ? "پاک‌کردن ارشدیت فعال است."
                        : undefined
                    }
                    scopeNoteFa="مراجع ارشدیت"
                    placeholder="کد یا نام ارشدیت…"
                  />
                </FormField>
                <label className="flex items-center gap-2 text-body">
                  <input
                    type="checkbox"
                    checked={clearSeniority}
                    onChange={(e) => {
                      setClearSeniority(e.target.checked);
                      if (e.target.checked) setSeniority(null);
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
                <FormField
                  label={
                    <>
                      لدر
                      {eventType === "LadderChanged"
                        ? " جدید"
                        : eventType === "PromotionRecorded"
                          ? " (اختیاری)"
                          : ""}
                    </>
                  }
                  htmlFor={`${formId}-ladder`}
                  required={
                    eventType === "LadderChanged" ||
                    eventType === "GradeChanged"
                  }
                >
                  <EntityPicker
                    id={`${formId}-ladder`}
                    search={ladderSearch}
                    value={ladder}
                    onValueChange={onLadderChange}
                    scopeNoteFa="مراجع لدر"
                    placeholder="کد یا نام لدر…"
                    aria-required={
                      eventType === "LadderChanged" ||
                      eventType === "GradeChanged"
                    }
                  />
                </FormField>
                <FormField
                  label="گرید جدید"
                  htmlFor={`${formId}-grade`}
                  required
                >
                  <EntityPicker
                    id={`${formId}-grade`}
                    search={gradeSearch}
                    value={gradeCascade.value}
                    onValueChange={onGradeChange}
                    disabled={gradeCascade.disabled}
                    disabledReasonFa={gradeCascade.disabledReasonFa}
                    scopeNoteFa="گریدهای لدر انتخاب‌شده"
                    placeholder="کد یا نام گرید…"
                    aria-required
                  />
                </FormField>
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
                  <FormField
                    label="مجوز ظرفیت (پیش‌فرض: قدیمی‌ترین سازگار)"
                    htmlFor={`${formId}-job-pref-apr`}
                  >
                    <select
                      className="border-control-border bg-surface h-control-height w-full rounded-md border px-3 text-body"
                      value={preferredApprovalId}
                      onChange={(e) => {
                        setPreferredApprovalId(e.target.value);
                        setDirty(true);
                      }}
                    >
                      <option value="">پیش‌فرض خودکار</option>
                      {compatibleApprovalsQuery.data.map((c, i) => (
                        <option key={c.approvalId} value={c.approvalId}>
                          {formatApprovalOptionLabel(
                            c.approvalId,
                            c.freeUnits,
                            i === 0,
                          )}
                        </option>
                      ))}
                    </select>
                  </FormField>
                ) : null}
              </>
            ) : null}
          </FormSection>
        ) : null}

        {isCompensationType(eventType) ? (
          <FormSection
            title={
              eventType === "CompensationChanged"
                ? "تغییر جبران‌خدمت"
                : "تغییر قرارداد"
            }
          >
            <p className="text-caption text-text-tertiary">
              مبلغ هرگز در payload پیش‌نویس ذخیره نمی‌شود — کانال حساس جداگانه.
              نهایی‌سازی نیازمند مجوز compensation.write است.
            </p>
            {eventType === "CompensationChanged" ? (
              <>
                {showCompField("compensation.amount") ? (
                  <FormField
                    label="مبلغ"
                    htmlFor={`${formId}-comp-amount`}
                    required
                    help="فقط در کانال حساس؛ کلید amount در payload مجاز نیست."
                  >
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
                    />
                  </FormField>
                ) : null}
                {showCompField("compensation.currency") ? (
                  <FormField label="کد ارز" htmlFor={`${formId}-currency`}>
                    <Input
                      value={currency}
                      onChange={(e) => {
                        setCurrency(e.target.value);
                        setDirty(true);
                      }}
                      dir="ltr"
                      autoComplete="off"
                    />
                  </FormField>
                ) : null}
                {showCompField("compensation.change_type") ? (
                  <FormField label="نوع تغییر" htmlFor={`${formId}-change-type`}>
                    <Input
                      value={changeType}
                      onChange={(e) => {
                        setChangeType(e.target.value);
                        setDirty(true);
                      }}
                      dir="ltr"
                      autoComplete="off"
                    />
                  </FormField>
                ) : null}
                {!showCompField("compensation.amount") &&
                !showCompField("compensation.currency") &&
                !showCompField("compensation.change_type") ? (
                  <p className="text-caption text-text-tertiary">
                    هیچ فیلد جبران‌خدمت در دیکشنری داده فعال نیست.
                  </p>
                ) : null}
              </>
            ) : (
              <>
                {showCompField("contract.contract_type") ? (
                  <FormField label="نوع قرارداد" htmlFor={`${formId}-auto-field-7`}>
                    <Input
                      value={contractType}
                      onChange={(e) => {
                        setContractType(e.target.value);
                        setDirty(true);
                      }}
                      dir="ltr"
                      autoComplete="off"
                    />
                  </FormField>
                ) : null}
                {showCompField("contract.collaboration_type") ? (
                  <FormField label="نوع همکاری" htmlFor={`${formId}-auto-field-8`}>
                    <Input
                      value={collaborationType}
                      onChange={(e) => {
                        setCollaborationType(e.target.value);
                        setDirty(true);
                      }}
                      dir="ltr"
                      autoComplete="off"
                    />
                  </FormField>
                ) : null}
                {!showCompField("contract.contract_type") &&
                !showCompField("contract.collaboration_type") ? (
                  <p className="text-caption text-text-tertiary">
                    فیلدهای قرارداد فعال در دیکشنری یافت نشد.
                  </p>
                ) : null}
              </>
            )}
          </FormSection>
        ) : null}

        {activeConflicts.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-field-label">تعارض‌ها</h3>
            <ConflictList conflicts={activeConflicts} />
            {warningsNeedingAck.map((w) => (
              <label
                key={w.code}
                className="flex items-start gap-2 text-body"
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
              <>
                {hasScheduledException ? (
                  <div className="mb-2">
                    <StatusBadge status="Exception" />
                  </div>
                ) : null}
                <FormField
                  label="دلیل Override (فقط HR Admin)"
                  htmlFor={`${formId}-override`}
                  required
                  help="ظرفیت یا محدودیت دیگر نیازمند تأیید صریح و ثبت ممیزی است."
                >
                  <Input
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    aria-required
                    autoComplete="off"
                  />
                </FormField>
              </>
            ) : null}
          </div>
        ) : null}

        {errorMsg ? (
          <p role="alert" className="text-body text-destructive">
            {errorMsg}
          </p>
        ) : null}
        {statusMsg ? (
          <p role="status" className="text-body text-text-secondary">
            {statusMsg}
          </p>
        ) : null}

        <FormFooter>
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
              variant="destructive"
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
        </FormFooter>
      </form>
      </Panel>

      {personId.trim() ? (
        <section
          className="space-y-3 border-t border-hairline pt-6"
          aria-labelledby={`${formId}-events`}
        >
          <h3 id={`${formId}-events`} className="text-field-label">
            رویدادهای معتبر (نمایش وضعیت حل‌شده)
          </h3>
          <p className="text-caption text-text-tertiary">
            زمان‌بندی‌شده تا تاریخ مؤثر وضعیت فعلی را تغییر نمی‌دهد. جدول زمانی
            کامل در Epic ۵.۳.
          </p>
          {eventsQuery.isLoading ? (
            <p role="status">در حال بارگذاری…</p>
          ) : eventsQuery.isError ? (
            <p role="alert" className="text-body text-destructive">
              {eventsQuery.error.message || "بارگذاری رویدادها ناموفق بود."}
            </p>
          ) : (eventsQuery.data?.length ?? 0) === 0 ? (
            <p className="text-body text-text-secondary">رویدادی ثبت نشده است.</p>
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
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={badge} />
                        <span className="text-body-medium" dir="ltr">
                          {row.event.eventType}
                        </span>
                      </div>
                      <p className="text-caption text-text-tertiary" dir="ltr">
                        {row.event.id.slice(0, 8)}… · مؤثر{" "}
                        {row.event.effectiveDate}
                      </p>
                      {chainHint ? (
                        <p className="text-caption text-text-tertiary">
                          زنجیره: {chainHint}
                        </p>
                      ) : null}
                    </div>
                    <RowActionCluster
                      actions={[
                        ...(showCancel
                          ? [
                              {
                                id: "cancel",
                                label: "لغو",
                                icon: Ban,
                                disabled: isMutationBlockedByAuthzChange,
                                disabledReason:
                                  "تا تأیید تغییر دسترسی، این اقدام مسدود است.",
                                onSelect: () =>
                                  openLifecycle("cancel", row.event.id),
                              },
                            ]
                          : []),
                        ...(showReverse
                          ? [
                              {
                                id: "reverse",
                                label: "بازگشت",
                                icon: Undo2,
                                disabled: isMutationBlockedByAuthzChange,
                                disabledReason:
                                  "تا تأیید تغییر دسترسی، این اقدام مسدود است.",
                                onSelect: () =>
                                  openLifecycle("reverse", row.event.id),
                              },
                            ]
                          : []),
                        ...(showCorrect
                          ? [
                              {
                                id: "correct",
                                label: "اصلاح",
                                icon: Pencil,
                                disabled: isMutationBlockedByAuthzChange,
                                disabledReason:
                                  "تا تأیید تغییر دسترسی، این اقدام مسدود است.",
                                onSelect: () =>
                                  openLifecycle("correct", row.event.id),
                              },
                            ]
                          : []),
                      ]}
                    />
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
            <p className="text-text-secondary">
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
            <p className="text-text-secondary" dir="ltr">
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
    </FormLayout>
  );
}
