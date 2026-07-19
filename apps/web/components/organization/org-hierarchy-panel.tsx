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
import {
  formatGregorianDateOnly,
  formatJalaliDisplayFromGregorian,
  todayGregorianInTehran,
} from "@/lib/jalali";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

import {
  CHILD_TYPE_FOR,
  findHierarchyNode,
  listActiveDirectChildren,
  PARENT_TYPE_FOR,
  UNIT_TYPE_LABEL_FA,
  type HierarchyNode,
  type UnitType,
} from "./org-unit-shared";

type ModalMode = "create" | "edit" | "deactivate" | null;

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

/**
 * Hierarchy tab panel — tree + create/edit/deactivate (Story 4b.6).
 */
export function OrgHierarchyPanel() {
  const formId = React.useId();
  const leaveGuard = useLeaveGuardOptional();
  const utils = api.useUtils();

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [modal, setModal] = React.useState<ModalMode>(null);
  const [editTargetId, setEditTargetId] = React.useState<string | null>(null);

  const [unitType, setUnitType] = React.useState<UnitType>("LEGAL_ENTITY");
  const [parentId, setParentId] = React.useState("");
  const [code, setCode] = React.useState("");
  const [nameFa, setNameFa] = React.useState("");
  const [startDate, setStartDate] = React.useState<string | undefined>();
  const [endDate, setEndDate] = React.useState<string | undefined>();
  const [deactivateEnd, setDeactivateEnd] = React.useState<
    string | undefined
  >();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [baseline, setBaseline] = React.useState({
    code: "",
    nameFa: "",
    parentId: "",
  });

  const asOf = React.useMemo(
    () => formatGregorianDateOnly(todayGregorianInTehran()),
    [],
  );

  const hierarchyQuery = api.organization.hierarchyAsOf.useQuery({
    asOfDate: asOf,
  });
  const listQuery = api.organization.list.useQuery({ includeInactive: true });

  const treeNodes = React.useMemo(
    (): HierarchyNode[] => (hierarchyQuery.data ?? []) as HierarchyNode[],
    [hierarchyQuery.data],
  );

  const selectedNode = selectedId
    ? findHierarchyNode(treeNodes, selectedId)
    : null;
  const addChildDisabled = selectedNode
    ? CHILD_TYPE_FOR[selectedNode.unitType] === null
    : false;
  const inactiveUnits = React.useMemo(() => {
    if (!listQuery.data) return [];
    return listQuery.data.filter((u) => !u.active);
  }, [listQuery.data]);
  const editNode = editTargetId
    ? findHierarchyNode(treeNodes, editTargetId) ??
      listQuery.data?.find((u) => u.id === editTargetId)
    : null;

  const parentsForType = React.useMemo(() => {
    const required = PARENT_TYPE_FOR[unitType];
    if (!required || !listQuery.data) return [];
    return listQuery.data.filter((u) => u.unitType === required && u.active);
  }, [unitType, listQuery.data]);

  const editParentOptions = React.useMemo(() => {
    const list = listQuery.data;
    if (!editNode || !("unitType" in editNode) || !list) return [];
    const unitTypeValue = (editNode as { unitType: UnitType }).unitType;
    const required = PARENT_TYPE_FOR[unitTypeValue];
    if (!required) return [];
    return list.filter(
      (u) =>
        u.unitType === required &&
        u.active &&
        u.id !== (editNode as { id: string }).id,
    );
  }, [editNode, listQuery.data]);

  const effectiveCreateParentId = React.useMemo(() => {
    if (unitType === "LEGAL_ENTITY") return "";
    if (parentId && parentsForType.some((p) => p.id === parentId)) {
      return parentId;
    }
    return parentsForType[0]?.id ?? "";
  }, [unitType, parentId, parentsForType]);

  const createDirty =
    modal === "create" &&
    (code.trim() !== "" ||
      nameFa.trim() !== "" ||
      Boolean(startDate) ||
      Boolean(endDate));

  const editDirty =
    modal === "edit" &&
    (code.trim() !== baseline.code ||
      nameFa.trim() !== baseline.nameFa ||
      parentId !== baseline.parentId);

  useLeaveGuardRegistration({
    id: "org-hierarchy-modal",
    isDirty: createDirty || editDirty,
    onDiscard: () => {
      resetForm();
      setModal(null);
      setEditTargetId(null);
    },
  });

  const dialogOpen =
    modal !== null && leaveGuard?.pending == null;

  function resetForm() {
    setCode("");
    setNameFa("");
    setStartDate(undefined);
    setEndDate(undefined);
    setDeactivateEnd(undefined);
    setFormError(null);
    setParentId("");
    setUnitType("LEGAL_ENTITY");
    setBaseline({ code: "", nameFa: "", parentId: "" });
  }

  const invalidate = React.useCallback(async () => {
    await Promise.all([
      utils.organization.list.invalidate(),
      utils.organization.hierarchyAsOf.invalidate(),
    ]);
  }, [utils]);

  const createMutation = api.organization.create.useMutation({
    onSuccess: async () => {
      resetForm();
      setModal(null);
      await invalidate();
    },
    onError: (err) => {
      setFormError(err.message || operationalCopy.orgActionFailed);
    },
  });

  const updateIdentity = api.organization.updateIdentity.useMutation();
  const reparentMutation = api.organization.reparent.useMutation();

  const activateMutation = api.organization.activate.useMutation({
    onSuccess: async () => {
      setFormError(null);
      await invalidate();
    },
    onError: (err) => {
      setFormError(err.message || operationalCopy.orgActionFailed);
    },
  });

  const deactivateMutation = api.organization.deactivate.useMutation({
    onSuccess: async () => {
      resetForm();
      setModal(null);
      setEditTargetId(null);
      await invalidate();
    },
    onError: (err) => {
      setFormError(err.message || operationalCopy.orgActionFailed);
    },
  });

  function openCreate(preferredParent?: HierarchyNode | null) {
    resetForm();
    if (preferredParent) {
      const childType = CHILD_TYPE_FOR[preferredParent.unitType];
      if (!childType) {
        return;
      }
      setUnitType(childType);
      setParentId(preferredParent.id);
    } else {
      setUnitType("LEGAL_ENTITY");
    }
    setModal("create");
  }

  function openEdit(node: HierarchyNode) {
    resetForm();
    setEditTargetId(node.id);
    setCode(node.code);
    setNameFa(node.nameFa);
    setParentId(node.parentId ?? "");
    setBaseline({
      code: node.code,
      nameFa: node.nameFa,
      parentId: node.parentId ?? "",
    });
    setUnitType(node.unitType);
    setModal("edit");
  }

  function openDeactivate(node: HierarchyNode) {
    resetForm();
    setEditTargetId(node.id);
    setModal("deactivate");
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!code.trim()) {
      setFormError(operationalCopy.orgCodeRequired);
      return;
    }
    if (!nameFa.trim()) {
      setFormError(operationalCopy.orgNameRequired);
      return;
    }
    if (!startDate) {
      setFormError(operationalCopy.orgStartRequired);
      return;
    }
    if (unitType !== "LEGAL_ENTITY" && !effectiveCreateParentId) {
      setFormError(operationalCopy.orgParentRequired);
      return;
    }
    createMutation.mutate({
      code: code.trim(),
      nameFa: nameFa.trim(),
      unitType,
      parentId: unitType === "LEGAL_ENTITY" ? null : effectiveCreateParentId,
      startDate,
      endDateExclusive: endDate ?? null,
    });
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTargetId || !editNode) return;
    setFormError(null);
    if (!code.trim()) {
      setFormError(operationalCopy.orgCodeRequired);
      return;
    }
    if (!nameFa.trim()) {
      setFormError(operationalCopy.orgNameRequired);
      return;
    }
    try {
      // Reparent first so impossible-parent fails closed before identity commits (AC#5).
      const nextParent =
        unitType === "LEGAL_ENTITY" ? null : parentId || null;
      if (nextParent !== (baseline.parentId || null)) {
        await reparentMutation.mutateAsync({
          id: editTargetId,
          newParentId: nextParent,
        });
      }
      if (code.trim() !== baseline.code || nameFa.trim() !== baseline.nameFa) {
        await updateIdentity.mutateAsync({
          id: editTargetId,
          code: code.trim(),
          nameFa: nameFa.trim(),
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
          : operationalCopy.orgActionFailed;
      setFormError(message);
    }
  }

  const deactivateTarget = editTargetId
    ? findHierarchyNode(treeNodes, editTargetId)
    : null;
  const blockingChildren = deactivateTarget
    ? listActiveDirectChildren(deactivateTarget)
    : [];

  const busyId =
    activateMutation.isPending
      ? (activateMutation.variables?.id ?? null)
      : deactivateMutation.isPending
        ? (deactivateMutation.variables?.id ?? null)
        : null;

  const getChildren = React.useCallback(
    (n: HierarchyNode) => n.children,
    [],
  );
  const getNodeId = React.useCallback((n: HierarchyNode) => n.id, []);

  return (
    <section className="space-y-6" aria-labelledby={`${formId}-heading`}>
      <header className="space-y-1">
        <h2 id={`${formId}-heading`} className="text-subtitle text-foreground">
          سلسله‌مراتب
        </h2>
        <p className="text-body text-muted-foreground">
          نهاد حقوقی ← واحد کسب‌وکار ← دپارتمان ← تیم · as-of{" "}
          {formatJalaliDisplayFromGregorian(asOf)}
        </p>
      </header>

      {formError && modal === null ? (
        <p role="alert" className="text-body text-destructive">
          {formError}
        </p>
      ) : null}

      {hierarchyQuery.isLoading || listQuery.isLoading ? (
        <div className="space-y-2" aria-busy="true">
          <StatusMessage kind="loading">
            {operationalCopy.orgListLoading}
          </StatusMessage>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-5/6" />
        </div>
      ) : hierarchyQuery.isError || listQuery.isError ? (
        <StatusMessage kind="error">{operationalCopy.orgListError}</StatusMessage>
      ) : treeNodes.length === 0 ? (
        <div className="space-y-3">
          <StatusMessage kind="empty">{operationalCopy.orgListEmpty}</StatusMessage>
          <Button type="button" onClick={() => openCreate(null)}>
            افزودن
          </Button>
        </div>
      ) : (
        <TreeNavigator
          aria-label="درخت سلسله‌مراتب سازمان"
          nodes={treeNodes}
          getChildren={getChildren}
          getNodeId={getNodeId}
          getLabel={(node) => (
            <span
              className={cn(
                "inline-flex min-w-0 max-w-full items-baseline gap-x-3",
                !node.active && "opacity-70",
              )}
            >
              <span className="truncate font-medium">{node.nameFa}</span>
              <span className="shrink-0 text-caption text-muted-foreground">
                {UNIT_TYPE_LABEL_FA[node.unitType]} ·{" "}
                {toPersianDigits(node.code)}
                {!node.active ? " · غیرفعال" : ""}
              </span>
            </span>
          )}
          expandedIds={expandedIds}
          onExpandedChange={setExpandedIds}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
          onActivate={(_id, node) => openEdit(node)}
          toolbar={
            <Button
              type="button"
              disabled={addChildDisabled}
              title={
                addChildDisabled
                  ? "برای تیم نمی‌توان واحد فرزند افزود"
                  : undefined
              }
              onClick={() => openCreate(selectedNode)}
            >
              افزودن
            </Button>
          }
          renderRowEnd={(node) => (
            <>
              {node.active ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busyId === node.id}
                  onClick={() => openDeactivate(node)}
                >
                  غیرفعال‌سازی
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busyId === node.id}
                  onClick={() => activateMutation.mutate({ id: node.id })}
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
      )}

      {inactiveUnits.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-body font-medium text-foreground">
            واحدهای غیرفعال (خارج از as-of جاری)
          </h3>
          <ul className="space-y-1" role="list">
            {inactiveUnits.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 py-2"
              >
                <span className="text-body text-muted-foreground">
                  {u.nameFa} · {UNIT_TYPE_LABEL_FA[u.unitType as UnitType]} ·{" "}
                  {toPersianDigits(u.code)}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busyId === u.id}
                  onClick={() => activateMutation.mutate({ id: u.id })}
                >
                  فعال‌سازی
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Create */}
      <Dialog
        open={dialogOpen && modal === "create"}
        onOpenChange={(open) => {
          if (!open) {
            resetForm();
            setModal(null);
          }
        }}
      >
        <DialogContent>
          <form onSubmit={submitCreate} noValidate>
            <DialogHeader>
              <DialogTitle>افزودن واحد سازمانی</DialogTitle>
              <DialogDescription>
                نوع و والد باید با قواعد سلسله‌مراتب سازگار باشد.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-caption" htmlFor={`${formId}-type`}>
                  نوع واحد
                </label>
                <select
                  id={`${formId}-type`}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={unitType}
                  onChange={(e) => {
                    const next = e.target.value as UnitType;
                    setUnitType(next);
                    setParentId("");
                  }}
                >
                  {(Object.keys(UNIT_TYPE_LABEL_FA) as UnitType[]).map((t) => (
                    <option key={t} value={t}>
                      {UNIT_TYPE_LABEL_FA[t]}
                    </option>
                  ))}
                </select>
              </div>
              {unitType !== "LEGAL_ENTITY" ? (
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-caption" htmlFor={`${formId}-parent`}>
                    والد
                  </label>
                  <select
                    id={`${formId}-parent`}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={effectiveCreateParentId}
                    onChange={(e) => setParentId(e.target.value)}
                  >
                    {parentsForType.length === 0 ? (
                      <option value="">والد فعالی نیست</option>
                    ) : (
                      parentsForType.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nameFa} ({toPersianDigits(p.code)})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              ) : null}
              <div className="space-y-1.5">
                <label className="text-caption" htmlFor={`${formId}-code`}>
                  کد
                </label>
                <Input
                  id={`${formId}-code`}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-caption" htmlFor={`${formId}-name`}>
                  نام فارسی
                </label>
                <Input
                  id={`${formId}-name`}
                  value={nameFa}
                  onChange={(e) => setNameFa(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-caption">تاریخ شروع</span>
                <JalaliDatePicker
                  aria-label="تاریخ شروع اعتبار واحد"
                  value={startDate}
                  onChange={setStartDate}
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-caption">تاریخ پایان (اختیاری)</span>
                <JalaliDatePicker
                  aria-label="تاریخ پایان اعتبار واحد"
                  value={endDate}
                  onChange={setEndDate}
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
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "در حال ثبت…" : "ایجاد"}
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
              <DialogTitle>ویرایش واحد سازمانی</DialogTitle>
              <DialogDescription>
                تغییر هویت و والد؛ جابه‌جایی نامعتبر با پیام فارسی مسدود می‌شود.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-caption" htmlFor={`${formId}-edit-code`}>
                  کد
                </label>
                <Input
                  id={`${formId}-edit-code`}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-caption" htmlFor={`${formId}-edit-name`}>
                  نام فارسی
                </label>
                <Input
                  id={`${formId}-edit-name`}
                  value={nameFa}
                  onChange={(e) => setNameFa(e.target.value)}
                  autoComplete="off"
                />
              </div>
              {unitType !== "LEGAL_ENTITY" ? (
                <div className="space-y-1.5 sm:col-span-2">
                  <label
                    className="text-caption"
                    htmlFor={`${formId}-edit-parent`}
                  >
                    والد
                  </label>
                  <select
                    id={`${formId}-edit-parent`}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                  >
                    {editParentOptions.length === 0 ? (
                      <option value="">والد فعالی نیست</option>
                    ) : (
                      editParentOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nameFa} ({toPersianDigits(p.code)})
                        </option>
                      ))
                    )}
                  </select>
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
              <Button
                type="submit"
                disabled={
                  updateIdentity.isPending || reparentMutation.isPending
                }
              >
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
            <DialogTitle>غیرفعال‌سازی واحد</DialogTitle>
            <DialogDescription>
              ردیف حذف نمی‌شود؛ تاریخچه حفظ می‌گردد. در صورت وابستگی فعال، عملیات
              مسدود می‌شود.
            </DialogDescription>
          </DialogHeader>
          {blockingChildren.length > 0 ? (
            <div className="space-y-1 py-2">
              <p className="text-body text-foreground">فرزندان فعال:</p>
              <ul className="list-disc ps-5 text-body text-muted-foreground">
                {blockingChildren.map((c) => (
                  <li key={c.id}>
                    {c.nameFa} ({toPersianDigits(c.code)})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="space-y-1.5 py-2">
            <span className="text-caption text-foreground">
              تاریخ پایان اعتبار (الزامی)
            </span>
            <JalaliDatePicker
              aria-label="تاریخ پایان برای غیرفعال‌سازی"
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
                deactivateMutation.isPending ||
                !editTargetId ||
                !deactivateEnd
              }
              onClick={() => {
                if (!editTargetId || !deactivateEnd) {
                  setFormError(operationalCopy.orgDeactivateEndRequired);
                  return;
                }
                setFormError(null);
                deactivateMutation.mutate({
                  id: editTargetId,
                  endDateExclusive: deactivateEnd,
                });
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
