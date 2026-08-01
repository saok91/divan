"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, CircleCheck, Eye } from "lucide-react";

import { GovernedDataTable } from "@/components/governed-data-table";
import type { GovernedColumn } from "@/components/governed-data-table";
import { HeadcountApprovalRecordDrawer } from "@/components/headcount/headcount-approval-record-drawer";
import type { HeadcountApprovalRow } from "@/components/headcount/headcount-approval-types";
import { FullBleedTableHost } from "@/components/layout/panel-section";
import { useLeaveGuardOptional } from "@/components/leave-guard";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { RowActionCluster } from "@/components/ui/row-action-overflow";
import { formatJalaliDisplayFromGregorian } from "@/lib/jalali";
import { toPersianDigits } from "@/lib/persian-digits";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

const STATUS_LABEL_FA: Record<string, string> = {
  draft: "پیش‌نویس",
  active: "فعال",
  cancelled: "لغوشده",
  expired: "منقضی",
};

const STATUS_CLASS: Record<string, string> = {
  draft: "status-badge-draft",
  active: "status-badge-effective",
  cancelled: "status-badge-cancelled",
  expired: "status-badge-reversed",
};

export type { HeadcountApprovalRow } from "@/components/headcount/headcount-approval-types";

const SECTION_DEFAULT_FILTERS: Record<string, string | string[]> = {};

function ApprovalStatusBadge({ status }: { status: string }) {
  const label = STATUS_LABEL_FA[status] ?? status;
  const token = STATUS_CLASS[status] ?? "status-badge-draft";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        token,
      )}
    >
      <span
        className="size-1.5 shrink-0 rounded-full bg-current opacity-70"
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

const COLUMNS: GovernedColumn<HeadcountApprovalRow>[] = [
  {
    id: "requirementCode",
    header: "کد نیازمندی",
    accessor: (r) => r.requirementCode,
    sticky: "identifier",
    sortable: true,
    filter: "text",
  },
  {
    id: "team",
    header: "تیم",
    accessor: (r) => r.teamLabel,
    filter: "text",
    sortable: true,
    cellOverflow: "wrap",
    maxWidthClass: "max-w-[14rem]",
  },
  {
    id: "allowed",
    header: "مصوب",
    accessor: (r) => r.allowedCount,
    sortable: true,
    cell: (r) => (
      <span className="text-tabular" dir="ltr">
        {toPersianDigits(String(r.allowedCount))}
      </span>
    ),
  },
  {
    id: "used",
    header: "مصرف",
    accessor: (r) => r.used,
    cell: (r) => (
      <span className="text-tabular" dir="ltr">
        {toPersianDigits(String(r.used))}
      </span>
    ),
  },
  {
    id: "reserved",
    header: "رزرو",
    accessor: (r) => r.reserved,
    cell: (r) => (
      <span className="text-tabular" dir="ltr">
        {toPersianDigits(String(r.reserved))}
      </span>
    ),
  },
  {
    id: "free",
    header: "آزاد",
    accessor: (r) => r.free,
    cell: (r) => (
      <span className="text-tabular" dir="ltr">
        {toPersianDigits(String(r.free))}
      </span>
    ),
  },
  {
    id: "status",
    header: "وضعیت",
    accessor: (r) => r.status,
    filter: "enum",
    enumOptions: [
      { value: "draft", label: "پیش‌نویس" },
      { value: "active", label: "فعال" },
      { value: "cancelled", label: "لغوشده" },
      { value: "expired", label: "منقضی" },
    ],
    cell: (r) => <ApprovalStatusBadge status={r.status} />,
  },
  {
    id: "validity",
    header: "اعتبار",
    accessor: (r) => `${r.validityStart}–${r.validityEndExclusive}`,
    cellOverflow: "wrap",
    maxWidthClass: "max-w-[12rem]",
    cell: (r) => (
      <span className="text-caption text-muted-foreground">
        {formatJalaliDisplayFromGregorian(r.validityStart)} –{" "}
        {formatJalaliDisplayFromGregorian(r.validityEndExclusive)}
      </span>
    ),
  },
];

function captureFocusTrigger(preferred?: HTMLElement | null): HTMLElement | null {
  if (preferred?.isConnected) return preferred;
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.isConnected) return active;
  return null;
}

/**
 * هدکانت tab — one GovernedDataTable of approvals + record-drawer (Story 9.4).
 */
export function HeadcountApprovalsTable() {
  const router = useRouter();
  const leaveGuard = useLeaveGuardOptional();
  const utils = api.useUtils();
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [drawerRow, setDrawerRow] = React.useState<HeadcountApprovalRow | null>(
    null,
  );
  const [drawerTrigger, setDrawerTrigger] =
    React.useState<HTMLElement | null>(null);

  const listQuery = api.headcount.listApprovals.useQuery();
  const teamsQuery = api.organization.list.useQuery({ includeInactive: false });

  const teamById = React.useMemo(() => {
    const map = new Map<
      string,
      { nameFa: string; code: string; label: string }
    >();
    for (const u of teamsQuery.data ?? []) {
      map.set(u.id, {
        nameFa: u.nameFa,
        code: u.code,
        label: `${u.nameFa} (${u.code})`,
      });
    }
    return map;
  }, [teamsQuery.data]);

  const rows = React.useMemo((): HeadcountApprovalRow[] => {
    const teamsLoading = teamsQuery.isLoading;
    return (listQuery.data ?? []).map((r) => {
      const team = teamById.get(r.teamId);
      return {
        id: r.id,
        requirementCode: r.requirementCode,
        teamId: r.teamId,
        teamLabel: team?.label ?? (teamsLoading ? "…" : "تیم نامشخص"),
        teamCode: team?.code ?? "",
        teamNameFa: team?.nameFa ?? "",
        jobTitleId: r.jobTitleId,
        allowedCount: r.allowedCount,
        used: r.used,
        reserved: r.reserved,
        free: r.free,
        status: r.status,
        validityStart: r.validityStart,
        validityEndExclusive: r.validityEndExclusive,
      };
    });
  }, [listQuery.data, teamById, teamsQuery.isLoading]);

  React.useEffect(() => {
    setDrawerRow((prev) => {
      if (!prev) return prev;
      const fresh = rows.find((r) => r.id === prev.id);
      return fresh ?? prev;
    });
  }, [rows]);

  const activateMutation = api.headcount.activateApproval.useMutation({
    onSuccess: async () => {
      setActionError(null);
      await utils.headcount.listApprovals.invalidate();
    },
    onError: (err) => setActionError(err.message),
  });
  const cancelMutation = api.headcount.cancelApproval.useMutation({
    onSuccess: async () => {
      setActionError(null);
      await utils.headcount.listApprovals.invalidate();
    },
    onError: (err) => setActionError(err.message),
  });

  function navigateCreate() {
    const href = "/headcount/create";
    if (leaveGuard) {
      void leaveGuard.requestNavigation(href);
      return;
    }
    router.push(href);
  }

  async function runAction(
    id: string,
    action: "activate" | "cancel",
  ): Promise<void> {
    setBusyId(id);
    setActionError(null);
    try {
      if (action === "activate") {
        await activateMutation.mutateAsync({ id });
      } else {
        await cancelMutation.mutateAsync({ id });
      }
    } catch {
      /* actionError set in onError */
    } finally {
      setBusyId(null);
    }
  }

  function openDrawer(
    row: HeadcountApprovalRow,
    trigger?: HTMLElement | null,
  ) {
    setDrawerTrigger(captureFocusTrigger(trigger));
    setDrawerRow(row);
  }

  return (
    <FullBleedTableHost className="space-y-3 py-4">
      {actionError ? (
        <FeedbackMessage kind="error">{actionError}</FeedbackMessage>
      ) : null}

      {listQuery.isError ? (
        <FeedbackMessage kind="error">
          {listQuery.error.message || "بارگذاری مجوزهای ظرفیت ممکن نشد."}
        </FeedbackMessage>
      ) : (
        <GovernedDataTable
          aria-label="جدول مجوزهای ظرفیت"
          preferencesKey="headcount-approvals"
          columns={COLUMNS}
          rows={rows}
          getRowId={(r) => r.id}
          sectionDefaultFilters={SECTION_DEFAULT_FILTERS}
          loading={listQuery.isLoading}
          emptyMessage="هنوز مجوزی ثبت نشده است."
          emptyAction={{
            labelFa: "ایجاد مجوز",
            onClick: () => navigateCreate(),
          }}
          toolbar={
            <Button type="button" onClick={() => navigateCreate()}>
              ایجاد مجوز
            </Button>
          }
          onRowClick={(row) => openDrawer(row)}
          rowActivateLabel="باز کردن جزئیات مجوز"
          rowActions={(row) => {
            type Action = {
              id: string;
              label: string;
              icon: typeof Eye;
              onSelect: () => void;
              disabled?: boolean;
              disabledReason?: string;
            };
            const actions: Action[] = [
              {
                id: "details",
                label: "جزئیات",
                icon: Eye,
                onSelect: () => {
                  const active = document.activeElement;
                  openDrawer(
                    row,
                    active instanceof HTMLElement ? active : null,
                  );
                },
              },
            ];
            if (row.status === "draft") {
              actions.push({
                id: "activate",
                label: "فعال‌سازی",
                icon: CircleCheck,
                disabled: busyId === row.id,
                disabledReason: "در حال انجام عملیات…",
                onSelect: () => void runAction(row.id, "activate"),
              });
            }
            if (row.status === "draft" || row.status === "active") {
              actions.push({
                id: "cancel",
                label: "لغو",
                icon: Ban,
                disabled: busyId === row.id,
                disabledReason: "در حال انجام عملیات…",
                onSelect: () => void runAction(row.id, "cancel"),
              });
            }
            return <RowActionCluster actions={actions} />;
          }}
        />
      )}

      <HeadcountApprovalRecordDrawer
        open={drawerRow != null}
        approval={drawerRow}
        triggerEl={drawerTrigger}
        onOpenChange={(open) => {
          if (!open) setDrawerRow(null);
        }}
      />
    </FullBleedTableHost>
  );
}
