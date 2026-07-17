"use client";

import * as React from "react";

import { JalaliDatePicker } from "@/components/jalali-date-picker";
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
import { formatJalaliDisplayFromGregorian, formatGregorianDateOnly, todayGregorianInTehran } from "@/lib/jalali";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type UnitType = "LEGAL_ENTITY" | "BUSINESS_UNIT" | "DEPARTMENT" | "TEAM";

const UNIT_TYPE_LABEL_FA: Record<UnitType, string> = {
  LEGAL_ENTITY: "نهاد حقوقی",
  BUSINESS_UNIT: "واحد کسب‌وکار",
  DEPARTMENT: "دپارتمان",
  TEAM: "تیم",
};

const PARENT_TYPE_FOR: Record<UnitType, UnitType | null> = {
  LEGAL_ENTITY: null,
  BUSINESS_UNIT: "LEGAL_ENTITY",
  DEPARTMENT: "BUSINESS_UNIT",
  TEAM: "DEPARTMENT",
};

type HierarchyNode = {
  id: string;
  code: string;
  nameFa: string;
  unitType: UnitType;
  parentId: string | null;
  startDate: string;
  endDateExclusive: string | null;
  active: boolean;
  children: HierarchyNode[];
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
      className={cn(
        "text-body",
        kind === "error" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {children}
    </p>
  );
}

function TreeRows({
  nodes,
  depth,
  onDeactivate,
  onActivate,
  busyId,
}: {
  nodes: HierarchyNode[];
  depth: number;
  onDeactivate: (id: string) => void;
  onActivate: (id: string) => void;
  busyId: string | null;
}) {
  return (
    <ul className="space-y-2" role="list">
      {nodes.map((node) => (
        <li key={node.id} className="space-y-2">
          <div
            className={cn(
              "flex flex-wrap items-center gap-3 border-b border-border/60 py-2",
              !node.active && "opacity-70",
            )}
            style={{ paddingInlineStart: `${depth * 1.25}rem` }}
          >
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-body font-medium text-foreground">
                {node.nameFa}
                <span className="ms-2 text-muted-foreground">
                  ({UNIT_TYPE_LABEL_FA[node.unitType]})
                </span>
              </p>
              <p className="text-caption text-muted-foreground">
                کد: {toPersianDigits(node.code)} · از{" "}
                {formatJalaliDisplayFromGregorian(node.startDate)}
                {node.endDateExclusive
                  ? ` تا ${formatJalaliDisplayFromGregorian(node.endDateExclusive)}`
                  : " (باز)"}
                {!node.active ? " · غیرفعال" : ""}
              </p>
            </div>
            <div className="flex gap-2">
              {node.active ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busyId === node.id}
                  onClick={() => onDeactivate(node.id)}
                >
                  غیرفعال‌سازی
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busyId === node.id}
                  onClick={() => onActivate(node.id)}
                >
                  فعال‌سازی
                </Button>
              )}
            </div>
          </div>
          {node.children.length > 0 ? (
            <TreeRows
              nodes={node.children}
              depth={depth + 1}
              onDeactivate={onDeactivate}
              onActivate={onActivate}
              busyId={busyId}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * Thin Admin panel for ساختار سازمان (Story 3.5).
 * Simple hierarchy view — not interactive org chart / drag-drop.
 * No member lists (Assignment = Epic 4).
 */
export function OrganizationPanel() {
  const formId = React.useId();
  const [unitType, setUnitType] = React.useState<UnitType>("LEGAL_ENTITY");
  const [parentId, setParentId] = React.useState("");
  const [code, setCode] = React.useState("");
  const [nameFa, setNameFa] = React.useState("");
  const [startDate, setStartDate] = React.useState<string | undefined>();
  const [endDate, setEndDate] = React.useState<string | undefined>();
  const [includeInactive, setIncludeInactive] = React.useState(true);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [confirmDeactivateId, setConfirmDeactivateId] = React.useState<
    string | null
  >(null);
  const [deactivateEnd, setDeactivateEnd] = React.useState<
    string | undefined
  >();

  const utils = api.useUtils();
  const asOf = React.useMemo(
    () => formatGregorianDateOnly(todayGregorianInTehran()),
    [],
  );

  const hierarchyQuery = api.organization.hierarchyAsOf.useQuery({
    asOfDate: asOf,
  });
  const listQuery = api.organization.list.useQuery({
    includeInactive,
  });

  const parentsForType = React.useMemo(() => {
    const required = PARENT_TYPE_FOR[unitType];
    if (!required || !listQuery.data) return [];
    return listQuery.data.filter(
      (u) => u.unitType === required && u.active,
    );
  }, [unitType, listQuery.data]);

  React.useEffect(() => {
    if (unitType === "LEGAL_ENTITY") {
      setParentId("");
      return;
    }
    if (
      parentId &&
      !parentsForType.some((p) => p.id === parentId)
    ) {
      setParentId(parentsForType[0]?.id ?? "");
    } else if (!parentId && parentsForType[0]) {
      setParentId(parentsForType[0].id);
    }
  }, [unitType, parentsForType, parentId]);

  const createMutation = api.organization.create.useMutation({
    onSuccess: async () => {
      setCode("");
      setNameFa("");
      setStartDate(undefined);
      setEndDate(undefined);
      setFormError(null);
      await Promise.all([
        utils.organization.list.invalidate(),
        utils.organization.hierarchyAsOf.invalidate(),
      ]);
    },
    onError: (err) => {
      setFormError(err.message || operationalCopy.orgActionFailed);
    },
  });

  const activateMutation = api.organization.activate.useMutation({
    onSuccess: async () => {
      setFormError(null);
      await Promise.all([
        utils.organization.list.invalidate(),
        utils.organization.hierarchyAsOf.invalidate(),
      ]);
    },
    onError: (err) => {
      setFormError(err.message || operationalCopy.orgActionFailed);
    },
  });

  const deactivateMutation = api.organization.deactivate.useMutation({
    onSuccess: async () => {
      setConfirmDeactivateId(null);
      setDeactivateEnd(undefined);
      setFormError(null);
      await Promise.all([
        utils.organization.list.invalidate(),
        utils.organization.hierarchyAsOf.invalidate(),
      ]);
    },
    onError: (err) => {
      setFormError(err.message || operationalCopy.orgActionFailed);
    },
  });

  const busyId =
    activateMutation.isPending
      ? (activateMutation.variables?.id ?? null)
      : deactivateMutation.isPending
        ? (deactivateMutation.variables?.id ?? null)
        : null;

  const treeNodes = React.useMemo((): HierarchyNode[] => {
    return (hierarchyQuery.data ?? []) as HierarchyNode[];
  }, [hierarchyQuery.data]);

  const inactiveUnits = React.useMemo(() => {
    if (!includeInactive || !listQuery.data) return [];
    return listQuery.data.filter((u) => !u.active);
  }, [includeInactive, listQuery.data]);

  function submitCreate(e: React.FormEvent) {
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
    if (unitType !== "LEGAL_ENTITY" && !parentId) {
      setFormError(operationalCopy.orgParentRequired);
      return;
    }
    createMutation.mutate({
      code: code.trim(),
      nameFa: nameFa.trim(),
      unitType,
      parentId: unitType === "LEGAL_ENTITY" ? null : parentId,
      startDate,
      endDateExclusive: endDate ?? null,
    });
  }

  return (
    <section className="space-y-8" aria-labelledby={`${formId}-heading`}>
      <header className="space-y-2">
        <h1 id={`${formId}-heading`} className="text-title text-foreground">
          ساختار سازمان
        </h1>
        <p className="text-body text-muted-foreground">
          مدیریت سلسله‌مراتب نهاد حقوقی ← واحد کسب‌وکار ← دپارتمان ← تیم بدون
          پاک‌کردن تاریخچه.
        </p>
      </header>

      <form
        className="space-y-4"
        onSubmit={submitCreate}
        noValidate
        aria-describedby={formError ? `${formId}-error` : undefined}
      >
        <h2 className="text-subtitle text-foreground">ایجاد واحد</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-caption text-foreground" htmlFor={`${formId}-type`}>
              نوع واحد
            </label>
            <select
              id={`${formId}-type`}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={unitType}
              onChange={(e) => setUnitType(e.target.value as UnitType)}
            >
              {(Object.keys(UNIT_TYPE_LABEL_FA) as UnitType[]).map((t) => (
                <option key={t} value={t}>
                  {UNIT_TYPE_LABEL_FA[t]}
                </option>
              ))}
            </select>
          </div>
          {unitType !== "LEGAL_ENTITY" ? (
            <div className="space-y-1.5">
              <label
                className="text-caption text-foreground"
                htmlFor={`${formId}-parent`}
              >
                والد
              </label>
              <select
                id={`${formId}-parent`}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={parentId}
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
            <label className="text-caption text-foreground" htmlFor={`${formId}-code`}>
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
            <label className="text-caption text-foreground" htmlFor={`${formId}-name`}>
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
            <span className="text-caption text-foreground">تاریخ شروع</span>
            <JalaliDatePicker
              aria-label="تاریخ شروع اعتبار واحد"
              value={startDate}
              onChange={setStartDate}
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-caption text-foreground">
              تاریخ پایان (اختیاری)
            </span>
            <JalaliDatePicker
              aria-label="تاریخ پایان اعتبار واحد"
              value={endDate}
              onChange={setEndDate}
            />
          </div>
        </div>
        {formError ? (
          <p id={`${formId}-error`} role="alert" className="text-body text-destructive">
            {formError}
          </p>
        ) : null}
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "در حال ثبت…" : "ایجاد واحد"}
        </Button>
      </form>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-subtitle text-foreground">سلسله‌مراتب</h2>
          <label className="flex items-center gap-2 text-caption text-foreground">
            <input
              type="checkbox"
              className="size-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            نمایش واحدهای غیرفعال/تاریخی
          </label>
        </div>

        {hierarchyQuery.isLoading || listQuery.isLoading ? (
          <div className="space-y-2" aria-busy="true">
            <StatusMessage kind="loading">
              {operationalCopy.orgListLoading}
            </StatusMessage>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-5/6" />
          </div>
        ) : hierarchyQuery.isError || listQuery.isError ? (
          <StatusMessage kind="error">
            {operationalCopy.orgListError}
          </StatusMessage>
        ) : treeNodes.length === 0 ? (
          <StatusMessage kind="empty">{operationalCopy.orgListEmpty}</StatusMessage>
        ) : (
          <TreeRows
            nodes={treeNodes}
            depth={0}
            busyId={busyId}
            onActivate={(id) => activateMutation.mutate({ id })}
            onDeactivate={(id) => {
              setFormError(null);
              setConfirmDeactivateId(id);
            }}
          />
        )}

        {includeInactive && inactiveUnits.length > 0 ? (
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
      </div>

      <Dialog
        open={confirmDeactivateId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDeactivateId(null);
            setDeactivateEnd(undefined);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>غیرفعال‌سازی واحد</DialogTitle>
            <DialogDescription>
              ردیف حذف نمی‌شود؛ تاریخچه حفظ می‌گردد. تاریخ پایان اعتبار الزامی
              است. در صورت وابستگی فعال، عملیات مسدود می‌شود.
            </DialogDescription>
          </DialogHeader>
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
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmDeactivateId(null);
                setDeactivateEnd(undefined);
              }}
            >
              انصراف
            </Button>
            <Button
              type="button"
              disabled={
                deactivateMutation.isPending ||
                !confirmDeactivateId ||
                !deactivateEnd
              }
              onClick={() => {
                if (!confirmDeactivateId || !deactivateEnd) {
                  setFormError(operationalCopy.orgDeactivateEndRequired);
                  return;
                }
                deactivateMutation.mutate({
                  id: confirmDeactivateId,
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
