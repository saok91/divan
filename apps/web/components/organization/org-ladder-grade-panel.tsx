"use client";

import * as React from "react";

import { JalaliDatePicker } from "@/components/jalali-date-picker";
import {
  useLeaveGuardOptional,
  useLeaveGuardRegistration,
} from "@/components/leave-guard";
import { TreeNavigator } from "@/components/tree-navigator";
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
import { cn } from "@/lib/utils";

type NodeKind = "ladder" | "grade";

type LadderGradeNode = {
  kind: NodeKind;
  id: string;
  code: string;
  nameFa: string;
  active: boolean;
  rank?: string;
  ladderId?: string;
  children: LadderGradeNode[];
};

type ModalMode =
  | "create-ladder"
  | "create-grade"
  | "edit"
  | "deactivate"
  | null;

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
      className={cn(
        "text-body",
        kind === "error" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {children}
    </p>
  );
}

function findNode(
  nodes: LadderGradeNode[],
  id: string,
): LadderGradeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

/**
 * Ladder → grade tree tab (Story 4b.6).
 * «افزودن گرید» disabled until a ladder node is selected.
 */
export function OrgLadderGradePanel() {
  const formId = React.useId();
  const leaveGuard = useLeaveGuardOptional();
  const utils = api.useUtils();

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [modal, setModal] = React.useState<ModalMode>(null);
  const [editTargetId, setEditTargetId] = React.useState<string | null>(null);

  const [code, setCode] = React.useState("");
  const [nameFa, setNameFa] = React.useState("");
  const [startDate, setStartDate] = React.useState<string | undefined>();
  const [rank, setRank] = React.useState("12.0");
  const [deactivateEnd, setDeactivateEnd] = React.useState<
    string | undefined
  >();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [baseline, setBaseline] = React.useState({
    code: "",
    nameFa: "",
    rank: "",
  });
  const [blockingGrades, setBlockingGrades] = React.useState<
    { id: string; code: string; nameFa: string }[]
  >([]);
  const [deactivateGradesLoading, setDeactivateGradesLoading] =
    React.useState(false);

  const laddersQuery = api.jobReference.listLadders.useQuery({
    includeInactive: true,
  });

  const expandedLadderIds = React.useMemo(
    () => [...expandedIds],
    [expandedIds],
  );

  const gradeQueries = api.useQueries((t) =>
    expandedLadderIds.map((ladderId) =>
      t.jobReference.listGradesForLadder({
        ladderId,
        includeInactive: true,
      }),
    ),
  );

  const gradesByLadder = React.useMemo(() => {
    const map = new Map<string, LadderGradeNode[]>();
    expandedLadderIds.forEach((ladderId, i) => {
      const data = gradeQueries[i]?.data;
      if (!data) {
        map.set(ladderId, []);
        return;
      }
      map.set(
        ladderId,
        data.map((g) => ({
          kind: "grade" as const,
          id: g.id,
          code: g.code,
          nameFa: g.nameFa,
          active: g.active,
          rank: g.rank,
          ladderId: g.ladderId,
          children: [],
        })),
      );
    });
    return map;
  }, [expandedLadderIds, gradeQueries]);

  const gradesLoading = expandedLadderIds.some((_, i) => {
    const q = gradeQueries[i];
    return Boolean(q && !q.data && (q.isLoading || q.isFetching));
  });
  const gradesLoadError = expandedLadderIds.some(
    (_, i) => gradeQueries[i]?.isError,
  );

  const treeNodes = React.useMemo((): LadderGradeNode[] => {
    return (laddersQuery.data ?? []).map((l) => ({
      kind: "ladder" as const,
      id: l.id,
      code: l.code,
      nameFa: l.nameFa,
      active: l.active,
      children: gradesByLadder.get(l.id) ?? [],
    }));
  }, [laddersQuery.data, gradesByLadder]);

  const selectedNode = selectedId ? findNode(treeNodes, selectedId) : null;
  const selectedLadderId =
    selectedNode?.kind === "ladder"
      ? selectedNode.id
      : selectedNode?.kind === "grade"
        ? (selectedNode.ladderId ?? null)
        : null;

  const createDirty =
    (modal === "create-ladder" || modal === "create-grade") &&
    (code.trim() !== "" ||
      nameFa.trim() !== "" ||
      Boolean(startDate) ||
      (modal === "create-grade" && rank !== "12.0"));

  const editDirty =
    modal === "edit" &&
    (code.trim() !== baseline.code ||
      nameFa.trim() !== baseline.nameFa ||
      (findNode(treeNodes, editTargetId ?? "")?.kind === "grade" &&
        rank !== baseline.rank));

  useLeaveGuardRegistration({
    id: "org-ladder-grade-modal",
    isDirty: createDirty || editDirty,
    onDiscard: () => {
      resetForm();
      setModal(null);
      setEditTargetId(null);
    },
  });

  const dialogOpen = modal !== null && leaveGuard?.pending == null;

  function resetForm() {
    setCode("");
    setNameFa("");
    setStartDate(undefined);
    setRank("12.0");
    setDeactivateEnd(undefined);
    setFormError(null);
    setBaseline({ code: "", nameFa: "", rank: "" });
    setBlockingGrades([]);
    setDeactivateGradesLoading(false);
  }

  const invalidate = React.useCallback(async () => {
    await Promise.all([
      utils.jobReference.listLadders.invalidate(),
      utils.jobReference.listGradesForLadder.invalidate(),
    ]);
  }, [utils]);

  const createLadder = api.jobReference.createLadder.useMutation({
    onSuccess: async () => {
      resetForm();
      setModal(null);
      await invalidate();
    },
    onError: (err) =>
      setFormError(err.message || operationalCopy.jobRefActionFailed),
  });

  const createGrade = api.jobReference.createGrade.useMutation({
    onSuccess: async () => {
      resetForm();
      setModal(null);
      await invalidate();
    },
    onError: (err) =>
      setFormError(err.message || operationalCopy.jobRefActionFailed),
  });

  const updateLadderIdentity = api.jobReference.updateLadderIdentity.useMutation();
  const updateGradeIdentity = api.jobReference.updateGradeIdentity.useMutation();

  const activateLadder = api.jobReference.activateLadder.useMutation({
    onSuccess: async () => {
      setFormError(null);
      await invalidate();
    },
    onError: (err) =>
      setFormError(err.message || operationalCopy.jobRefActionFailed),
  });
  const activateGrade = api.jobReference.activateGrade.useMutation({
    onSuccess: async () => {
      setFormError(null);
      await invalidate();
    },
    onError: (err) =>
      setFormError(err.message || operationalCopy.jobRefActionFailed),
  });

  const deactivateLadder = api.jobReference.deactivateLadder.useMutation({
    onSuccess: async () => {
      resetForm();
      setModal(null);
      setEditTargetId(null);
      await invalidate();
    },
    onError: (err) =>
      setFormError(err.message || operationalCopy.jobRefActionFailed),
  });
  const deactivateGrade = api.jobReference.deactivateGrade.useMutation({
    onSuccess: async () => {
      resetForm();
      setModal(null);
      setEditTargetId(null);
      await invalidate();
    },
    onError: (err) =>
      setFormError(err.message || operationalCopy.jobRefActionFailed),
  });

  function openEdit(node: LadderGradeNode) {
    resetForm();
    setEditTargetId(node.id);
    setCode(node.code);
    setNameFa(node.nameFa);
    setRank(node.rank ?? "12.0");
    setBaseline({
      code: node.code,
      nameFa: node.nameFa,
      rank: node.rank ?? "12.0",
    });
    setModal("edit");
  }

  async function openDeactivate(node: LadderGradeNode) {
    resetForm();
    setEditTargetId(node.id);
    if (node.kind === "ladder") {
      setExpandedIds((prev) => new Set(prev).add(node.id));
      setDeactivateGradesLoading(true);
      try {
        const grades = await utils.jobReference.listGradesForLadder.fetch({
          ladderId: node.id,
          includeInactive: true,
        });
        setBlockingGrades(
          grades
            .filter((g) => g.active)
            .map((g) => ({ id: g.id, code: g.code, nameFa: g.nameFa })),
        );
      } catch (err) {
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : operationalCopy.jobRefActionFailed;
        setFormError(message);
        setBlockingGrades([]);
      } finally {
        setDeactivateGradesLoading(false);
      }
    }
    setModal("deactivate");
  }

  async function submitCreateLadder(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!code.trim() || !nameFa.trim() || !startDate) {
      setFormError("کد، نام و تاریخ شروع الزامی است.");
      return;
    }
    createLadder.mutate({
      code: code.trim(),
      nameFa: nameFa.trim(),
      startDate,
    });
  }

  async function submitCreateGrade(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!selectedLadderId) {
      setFormError("انتخاب لدر برای گرید الزامی است.");
      return;
    }
    if (!code.trim() || !nameFa.trim() || !startDate || !rank.trim()) {
      setFormError("کد، نام، رتبه و تاریخ شروع الزامی است.");
      return;
    }
    createGrade.mutate({
      code: code.trim(),
      nameFa: nameFa.trim(),
      startDate,
      ladderId: selectedLadderId,
      rank: rank.trim(),
    });
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTargetId) return;
    const node = findNode(treeNodes, editTargetId);
    if (!node) {
      setFormError(operationalCopy.jobRefActionFailed);
      return;
    }
    setFormError(null);
    if (!code.trim() || !nameFa.trim()) {
      setFormError("کد و نام الزامی است.");
      return;
    }
    if (node.kind === "grade" && !rank.trim()) {
      setFormError("کد، نام، رتبه و تاریخ شروع الزامی است.");
      return;
    }
    try {
      if (node.kind === "ladder") {
        await updateLadderIdentity.mutateAsync({
          id: editTargetId,
          code: code.trim(),
          nameFa: nameFa.trim(),
        });
      } else {
        await updateGradeIdentity.mutateAsync({
          id: editTargetId,
          code: code.trim(),
          nameFa: nameFa.trim(),
          rank: rank.trim(),
        });
      }
      resetForm();
      setModal(null);
      setEditTargetId(null);
      await invalidate();
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : operationalCopy.jobRefActionFailed;
      setFormError(message);
    }
  }

  const deactivateTarget = editTargetId
    ? findNode(treeNodes, editTargetId)
    : null;
  const activeGradesForLadder =
    deactivateTarget?.kind === "ladder" ? blockingGrades : [];

  const busyId =
    activateLadder.isPending
      ? (activateLadder.variables?.id ?? null)
      : activateGrade.isPending
        ? (activateGrade.variables?.id ?? null)
        : deactivateLadder.isPending
          ? (deactivateLadder.variables?.id ?? null)
          : deactivateGrade.isPending
            ? (deactivateGrade.variables?.id ?? null)
            : null;

  const editSaving =
    updateLadderIdentity.isPending || updateGradeIdentity.isPending;

  const getChildren = React.useCallback(
    (n: LadderGradeNode) => n.children,
    [],
  );
  const getNodeId = React.useCallback((n: LadderGradeNode) => n.id, []);

  const gradeCtaDisabled = selectedNode?.kind !== "ladder";

  return (
    <section className="space-y-6" aria-labelledby={`${formId}-heading`}>
      <header className="space-y-1">
        <h2 id={`${formId}-heading`} className="text-subtitle text-foreground">
          لدر و گرید
        </h2>
        <p className="text-body text-muted-foreground">
          نردبان‌ها والد و گریدها فرزند هستند. افزودن گرید فقط با انتخاب نردبان
          فعال می‌شود.
        </p>
      </header>

      {formError && modal === null ? (
        <p role="alert" className="text-body text-destructive">
          {formError}
        </p>
      ) : null}

      {laddersQuery.isLoading ? (
        <div className="space-y-2" aria-busy="true">
          <StatusMessage kind="loading">در حال بارگذاری…</StatusMessage>
          <Skeleton className="h-10 w-full" />
        </div>
      ) : laddersQuery.isError ? (
        <StatusMessage kind="error">
          {operationalCopy.jobRefListError}
        </StatusMessage>
      ) : treeNodes.length === 0 ? (
        <div className="space-y-3">
          <StatusMessage kind="empty">
            {operationalCopy.jobRefLaddersEmpty}
          </StatusMessage>
          <Button
            type="button"
            onClick={() => {
              resetForm();
              setModal("create-ladder");
            }}
          >
            افزودن نردبان
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {gradesLoading ? (
            <StatusMessage kind="loading">
              در حال بارگذاری گریدها…
            </StatusMessage>
          ) : null}
          {gradesLoadError ? (
            <StatusMessage kind="error">
              {operationalCopy.jobRefListError}
            </StatusMessage>
          ) : null}
          <TreeNavigator
          aria-label="درخت لدر و گرید"
          nodes={treeNodes}
          getChildren={getChildren}
          getNodeId={getNodeId}
          isBranch={(node) => node.kind === "ladder"}
          getLabel={(node) => (
            <span
              className={cn(
                "inline-flex min-w-0 max-w-full items-baseline gap-x-3",
                !node.active && "opacity-70",
              )}
            >
              <span
                className={cn(
                  "truncate",
                  node.kind === "ladder" ? "font-medium" : "font-normal",
                )}
              >
                {node.nameFa}
              </span>
              <span className="shrink-0 text-caption text-muted-foreground">
                {toPersianDigits(node.code)}
                {node.rank
                  ? ` · رتبه ${toPersianDigits(node.rank)}`
                  : ""}
                {!node.active ? " · غیرفعال" : ""}
              </span>
            </span>
          )}
          getRowClassName={(node) =>
            node.kind === "ladder" ? "bg-muted/30" : undefined
          }
          expandedIds={expandedIds}
          onExpandedChange={setExpandedIds}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
          onActivate={(_id, node) => openEdit(node)}
          toolbar={
            <>
              <Button
                type="button"
                onClick={() => {
                  resetForm();
                  setModal("create-ladder");
                }}
              >
                افزودن نردبان
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={gradeCtaDisabled}
                onClick={() => {
                  resetForm();
                  setModal("create-grade");
                }}
              >
                افزودن گرید
              </Button>
            </>
          }
          renderRowEnd={(node) => (
            <>
              {node.active ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busyId === node.id}
                  onClick={() => void openDeactivate(node)}
                >
                  غیرفعال‌سازی
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busyId === node.id}
                  onClick={() => {
                    if (node.kind === "ladder") {
                      activateLadder.mutate({ id: node.id });
                    } else {
                      activateGrade.mutate({ id: node.id });
                    }
                  }}
                >
                  فعال‌سازی
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => openEdit(node)}
              >
                ویرایش
              </Button>
            </>
          )}
        />
        </div>
      )}

      {/* Create ladder */}
      <Dialog
        open={dialogOpen && modal === "create-ladder"}
        onOpenChange={(open) => {
          if (!open) {
            resetForm();
            setModal(null);
          }
        }}
      >
        <DialogContent>
          <form onSubmit={submitCreateLadder} noValidate>
            <DialogHeader>
              <DialogTitle>افزودن نردبان</DialogTitle>
              <DialogDescription>نردبان شغلی جدید.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-caption" htmlFor={`${formId}-l-code`}>
                  کد
                </label>
                <Input
                  id={`${formId}-l-code`}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-caption" htmlFor={`${formId}-l-name`}>
                  نام فارسی
                </label>
                <Input
                  id={`${formId}-l-name`}
                  value={nameFa}
                  onChange={(e) => setNameFa(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <span className="text-caption">تاریخ شروع</span>
                <JalaliDatePicker
                  aria-label="تاریخ شروع نردبان"
                  value={startDate}
                  onChange={setStartDate}
                />
              </div>
            </div>
            {formError ? (
              <p role="alert" className="text-body text-destructive">
                {formError}
              </p>
            ) : null}
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm();
                  setModal(null);
                }}
              >
                انصراف
              </Button>
              <Button type="submit" disabled={createLadder.isPending}>
                ایجاد
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create grade */}
      <Dialog
        open={dialogOpen && modal === "create-grade"}
        onOpenChange={(open) => {
          if (!open) {
            resetForm();
            setModal(null);
          }
        }}
      >
        <DialogContent>
          <form onSubmit={submitCreateGrade} noValidate>
            <DialogHeader>
              <DialogTitle>افزودن گرید</DialogTitle>
              <DialogDescription>
                گرید زیر نردبان انتخاب‌شده؛ نیم‌گرید مجاز است.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <p className="text-caption text-muted-foreground">
                  نردبان:{" "}
                  {selectedNode?.kind === "ladder"
                    ? selectedNode.nameFa
                    : "—"}
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-caption" htmlFor={`${formId}-g-code`}>
                  کد
                </label>
                <Input
                  id={`${formId}-g-code`}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-caption" htmlFor={`${formId}-g-name`}>
                  نام فارسی
                </label>
                <Input
                  id={`${formId}-g-name`}
                  value={nameFa}
                  onChange={(e) => setNameFa(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-caption" htmlFor={`${formId}-g-rank`}>
                  رتبه
                </label>
                <Input
                  id={`${formId}-g-rank`}
                  value={rank}
                  onChange={(e) => setRank(e.target.value)}
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-caption">تاریخ شروع</span>
                <JalaliDatePicker
                  aria-label="تاریخ شروع گرید"
                  value={startDate}
                  onChange={setStartDate}
                />
              </div>
            </div>
            {formError ? (
              <p role="alert" className="text-body text-destructive">
                {formError}
              </p>
            ) : null}
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm();
                  setModal(null);
                }}
              >
                انصراف
              </Button>
              <Button type="submit" disabled={createGrade.isPending}>
                ایجاد
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog
        open={dialogOpen && modal === "edit"}
        onOpenChange={(open) => {
          if (!open) {
            resetForm();
            setModal(null);
            setEditTargetId(null);
          }
        }}
      >
        <DialogContent>
          <form onSubmit={submitEdit} noValidate>
            <DialogHeader>
              <DialogTitle>ویرایش</DialogTitle>
              <DialogDescription>به‌روزرسانی هویت مرجع.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-caption" htmlFor={`${formId}-e-code`}>
                  کد
                </label>
                <Input
                  id={`${formId}-e-code`}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-caption" htmlFor={`${formId}-e-name`}>
                  نام فارسی
                </label>
                <Input
                  id={`${formId}-e-name`}
                  value={nameFa}
                  onChange={(e) => setNameFa(e.target.value)}
                />
              </div>
              {deactivateTarget?.kind === "grade" ||
              findNode(treeNodes, editTargetId ?? "")?.kind === "grade" ? (
                <div className="space-y-1.5">
                  <label className="text-caption" htmlFor={`${formId}-e-rank`}>
                    رتبه
                  </label>
                  <Input
                    id={`${formId}-e-rank`}
                    value={rank}
                    onChange={(e) => setRank(e.target.value)}
                    inputMode="decimal"
                  />
                </div>
              ) : null}
            </div>
            {formError ? (
              <p role="alert" className="text-body text-destructive">
                {formError}
              </p>
            ) : null}
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm();
                  setModal(null);
                  setEditTargetId(null);
                }}
              >
                انصراف
              </Button>
              <Button type="submit" disabled={editSaving}>
                ذخیره
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deactivate */}
      <Dialog
        open={dialogOpen && modal === "deactivate"}
        onOpenChange={(open) => {
          if (!open) {
            resetForm();
            setModal(null);
            setEditTargetId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>غیرفعال‌سازی</DialogTitle>
            <DialogDescription>
              رکورد حذف نمی‌شود. لدر با گرید فعال مسدود می‌شود.
            </DialogDescription>
          </DialogHeader>
          {deactivateGradesLoading ? (
            <p role="status" className="text-body text-muted-foreground py-2">
              در حال بارگذاری گریدهای فعال…
            </p>
          ) : activeGradesForLadder.length > 0 ? (
            <div className="space-y-1 py-2">
              <p className="text-body">گریدهای فعال:</p>
              <ul className="list-disc ps-5 text-body text-muted-foreground">
                {activeGradesForLadder.map((g) => (
                  <li key={g.id}>
                    {g.nameFa} ({toPersianDigits(g.code)})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="space-y-1.5 py-2">
            <span className="text-caption">تاریخ پایان اعتبار</span>
            <JalaliDatePicker
              aria-label="تاریخ پایان اعتبار"
              value={deactivateEnd}
              onChange={setDeactivateEnd}
            />
          </div>
          {formError ? (
            <p role="alert" className="text-body text-destructive">
              {formError}
            </p>
          ) : null}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                setModal(null);
                setEditTargetId(null);
              }}
            >
              انصراف
            </Button>
            <Button
              type="button"
              disabled={
                !editTargetId ||
                !deactivateEnd ||
                deactivateGradesLoading ||
                deactivateLadder.isPending ||
                deactivateGrade.isPending
              }
              onClick={() => {
                if (!editTargetId || !deactivateEnd || !deactivateTarget) {
                  setFormError(operationalCopy.orgDeactivateEndRequired);
                  return;
                }
                setFormError(null);
                const payload = {
                  id: editTargetId,
                  endDateExclusive: deactivateEnd,
                };
                if (deactivateTarget.kind === "ladder") {
                  deactivateLadder.mutate(payload);
                } else {
                  deactivateGrade.mutate(payload);
                }
              }}
            >
              تأیید غیرفعال‌سازی
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
