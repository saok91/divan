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
import { formatJalaliDisplayFromGregorian } from "@/lib/jalali";
import { operationalCopy } from "@/lib/operational-copy";
import { toPersianDigits } from "@/lib/persian-digits";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type ConceptTab =
  | "role"
  | "jobTitle"
  | "ladder"
  | "grade"
  | "seniority";

const TAB_LABEL_FA: Record<ConceptTab, string> = {
  role: "نقش سازمانی",
  jobTitle: "عنوان شغلی",
  ladder: "لدر",
  grade: "گرید",
  seniority: "ارشدیت",
};

const TAB_KEYS = Object.keys(TAB_LABEL_FA) as ConceptTab[];

type RefRow = {
  id: string;
  code: string;
  nameFa: string;
  startDate: string;
  endDateExclusive: string | null;
  active: boolean;
  rank?: string;
  ladderId?: string;
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

/**
 * Thin Admin section for مراجع شغلی (Story 3.6 / FR-10).
 * Five distinct concepts — no Grade↔Seniority mapping, no Assignment writes.
 */
export function JobReferencePanel() {
  const formId = React.useId();
  const [tab, setTab] = React.useState<ConceptTab>("ladder");
  const [code, setCode] = React.useState("");
  const [nameFa, setNameFa] = React.useState("");
  const [startDate, setStartDate] = React.useState<string | undefined>();
  const [rank, setRank] = React.useState("12.0");
  const [ladderId, setLadderId] = React.useState("");
  const [includeInactive, setIncludeInactive] = React.useState(true);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = React.useState<{
    id: string;
    concept: ConceptTab;
  } | null>(null);
  const [deactivateEnd, setDeactivateEnd] = React.useState<
    string | undefined
  >();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const utils = api.useUtils();

  const rolesQuery = api.jobReference.listRoles.useQuery(
    { includeInactive },
    { enabled: tab === "role" },
  );
  const titlesQuery = api.jobReference.listJobTitles.useQuery(
    { includeInactive },
    { enabled: tab === "jobTitle" },
  );
  const laddersQuery = api.jobReference.listLadders.useQuery({
    includeInactive: true,
  });
  const gradesQuery = api.jobReference.listGradesForLadder.useQuery(
    {
      ladderId: ladderId || "__none__",
      includeInactive,
    },
    { enabled: tab === "grade" && Boolean(ladderId) },
  );
  const senioritiesQuery = api.jobReference.listSeniorities.useQuery(
    { includeInactive },
    { enabled: tab === "seniority" },
  );

  const activeLadders = React.useMemo(
    () => (laddersQuery.data ?? []).filter((l) => l.active),
    [laddersQuery.data],
  );

  const laddersForSelect = React.useMemo(
    () =>
      (laddersQuery.data ?? []).filter((l) => includeInactive || l.active),
    [laddersQuery.data, includeInactive],
  );

  React.useEffect(() => {
    if (tab !== "grade") return;
    if (ladderId) {
      const stillVisible = laddersForSelect.some((l) => l.id === ladderId);
      if (!stillVisible) {
        setLadderId(laddersForSelect[0]?.id ?? "");
      }
      return;
    }
    const preferred = activeLadders[0] ?? laddersForSelect[0];
    if (preferred) {
      setLadderId(preferred.id);
    }
  }, [tab, ladderId, activeLadders, laddersForSelect]);

  const selectTab = React.useCallback((next: ConceptTab) => {
    setTab(next);
    setFormError(null);
  }, []);

  const onTabKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, key: ConceptTab) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const idx = TAB_KEYS.indexOf(key);
      if (idx < 0) return;
      // RTL: ArrowLeft → next tab, ArrowRight → previous
      const delta = event.key === "ArrowLeft" ? 1 : -1;
      const next =
        TAB_KEYS[(idx + delta + TAB_KEYS.length) % TAB_KEYS.length]!;
      selectTab(next);
      const el = document.getElementById(`${formId}-tab-${next}`);
      el?.focus();
    },
    [formId, selectTab],
  );

  const invalidateAll = React.useCallback(async () => {
    await Promise.all([
      utils.jobReference.listRoles.invalidate(),
      utils.jobReference.listJobTitles.invalidate(),
      utils.jobReference.listLadders.invalidate(),
      utils.jobReference.listGradesForLadder.invalidate(),
      utils.jobReference.listSeniorities.invalidate(),
    ]);
  }, [utils]);

  const createRole = api.jobReference.createRole.useMutation({
    onSuccess: async () => {
      setFormError(null);
      setCode("");
      setNameFa("");
      setStartDate(undefined);
      await invalidateAll();
    },
    onError: (err) => setFormError(err.message),
  });
  const createJobTitle = api.jobReference.createJobTitle.useMutation({
    onSuccess: async () => {
      setFormError(null);
      setCode("");
      setNameFa("");
      setStartDate(undefined);
      await invalidateAll();
    },
    onError: (err) => setFormError(err.message),
  });
  const createLadder = api.jobReference.createLadder.useMutation({
    onSuccess: async () => {
      setFormError(null);
      setCode("");
      setNameFa("");
      setStartDate(undefined);
      await invalidateAll();
    },
    onError: (err) => setFormError(err.message),
  });
  const createGrade = api.jobReference.createGrade.useMutation({
    onSuccess: async () => {
      setFormError(null);
      setCode("");
      setNameFa("");
      setStartDate(undefined);
      await invalidateAll();
    },
    onError: (err) => setFormError(err.message),
  });
  const createSeniority = api.jobReference.createSeniority.useMutation({
    onSuccess: async () => {
      setFormError(null);
      setCode("");
      setNameFa("");
      setStartDate(undefined);
      await invalidateAll();
    },
    onError: (err) => setFormError(err.message),
  });

  const activateRole = api.jobReference.activateRole.useMutation({
    onSettled: async () => {
      setBusyId(null);
      await invalidateAll();
    },
    onError: (err) => setFormError(err.message),
  });
  const activateJobTitle = api.jobReference.activateJobTitle.useMutation({
    onSettled: async () => {
      setBusyId(null);
      await invalidateAll();
    },
    onError: (err) => setFormError(err.message),
  });
  const activateLadderMut = api.jobReference.activateLadder.useMutation({
    onSettled: async () => {
      setBusyId(null);
      await invalidateAll();
    },
    onError: (err) => setFormError(err.message),
  });
  const activateGrade = api.jobReference.activateGrade.useMutation({
    onSettled: async () => {
      setBusyId(null);
      await invalidateAll();
    },
    onError: (err) => setFormError(err.message),
  });
  const activateSeniority = api.jobReference.activateSeniority.useMutation({
    onSettled: async () => {
      setBusyId(null);
      await invalidateAll();
    },
    onError: (err) => setFormError(err.message),
  });

  const deactivateRole = api.jobReference.deactivateRole.useMutation({
    onSettled: async () => {
      setBusyId(null);
      setConfirmDeactivate(null);
      setDeactivateEnd(undefined);
      await invalidateAll();
    },
    onError: (err) => setFormError(err.message),
  });
  const deactivateJobTitle = api.jobReference.deactivateJobTitle.useMutation({
    onSettled: async () => {
      setBusyId(null);
      setConfirmDeactivate(null);
      setDeactivateEnd(undefined);
      await invalidateAll();
    },
    onError: (err) => setFormError(err.message),
  });
  const deactivateLadderMut = api.jobReference.deactivateLadder.useMutation({
    onSettled: async () => {
      setBusyId(null);
      setConfirmDeactivate(null);
      setDeactivateEnd(undefined);
      await invalidateAll();
    },
    onError: (err) => setFormError(err.message),
  });
  const deactivateGrade = api.jobReference.deactivateGrade.useMutation({
    onSettled: async () => {
      setBusyId(null);
      setConfirmDeactivate(null);
      setDeactivateEnd(undefined);
      await invalidateAll();
    },
    onError: (err) => setFormError(err.message),
  });
  const deactivateSeniority = api.jobReference.deactivateSeniority.useMutation({
    onSettled: async () => {
      setBusyId(null);
      setConfirmDeactivate(null);
      setDeactivateEnd(undefined);
      await invalidateAll();
    },
    onError: (err) => setFormError(err.message),
  });

  const listQuery =
    tab === "role"
      ? rolesQuery
      : tab === "jobTitle"
        ? titlesQuery
        : tab === "ladder"
          ? laddersQuery
          : tab === "grade"
            ? gradesQuery
            : senioritiesQuery;

  const rows: RefRow[] = React.useMemo(() => {
    if (tab === "grade") {
      return (gradesQuery.data ?? []).map((g) => ({
        id: g.id,
        code: g.code,
        nameFa: g.nameFa,
        startDate: g.startDate,
        endDateExclusive: g.endDateExclusive,
        active: g.active,
        rank: g.rank,
        ladderId: g.ladderId,
      }));
    }
    if (tab === "ladder") {
      return (laddersQuery.data ?? []).filter(
        (l) => includeInactive || l.active,
      );
    }
    const data = listQuery.data;
    if (!data) return [];
    return data as RefRow[];
  }, [tab, gradesQuery.data, laddersQuery.data, listQuery.data, includeInactive]);

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!startDate?.trim()) {
      setFormError("تاریخ شروع الزامی است.");
      return;
    }
    const base = {
      code,
      nameFa,
      startDate,
    };
    if (tab === "role") createRole.mutate(base);
    else if (tab === "jobTitle") createJobTitle.mutate(base);
    else if (tab === "ladder") createLadder.mutate(base);
    else if (tab === "seniority") createSeniority.mutate(base);
    else if (tab === "grade") {
      if (!ladderId) {
        setFormError("انتخاب لدر برای گرید الزامی است.");
        return;
      }
      createGrade.mutate({ ...base, ladderId, rank });
    }
  }

  function onActivate(id: string) {
    setFormError(null);
    setBusyId(id);
    if (tab === "role") activateRole.mutate({ id });
    else if (tab === "jobTitle") activateJobTitle.mutate({ id });
    else if (tab === "ladder") activateLadderMut.mutate({ id });
    else if (tab === "grade") activateGrade.mutate({ id });
    else activateSeniority.mutate({ id });
  }

  function confirmDeactivateSubmit() {
    if (!confirmDeactivate) return;
    if (!deactivateEnd?.trim()) {
      setFormError("برای غیرفعال‌سازی باید تاریخ پایان اعتبار مشخص شود.");
      return;
    }
    setFormError(null);
    setBusyId(confirmDeactivate.id);
    const payload = {
      id: confirmDeactivate.id,
      endDateExclusive: deactivateEnd,
    };
    const c = confirmDeactivate.concept;
    if (c === "role") deactivateRole.mutate(payload);
    else if (c === "jobTitle") deactivateJobTitle.mutate(payload);
    else if (c === "ladder") deactivateLadderMut.mutate(payload);
    else if (c === "grade") deactivateGrade.mutate(payload);
    else deactivateSeniority.mutate(payload);
  }

  const creating =
    createRole.isPending ||
    createJobTitle.isPending ||
    createLadder.isPending ||
    createGrade.isPending ||
    createSeniority.isPending;

  return (
    <section className="space-y-8 border-t border-border pt-10" aria-labelledby={`${formId}-heading`}>
      <header className="space-y-2">
        <h2 id={`${formId}-heading`} className="text-title text-foreground">
          مراجع شغلی
        </h2>
        <p className="text-body text-muted-foreground max-w-2xl">
          نقش سازمانی، عنوان شغلی، لدر، گرید و ارشدیت به‌صورت پنج مرجع مستقل
          نگهداری می‌شوند. گرید فقط داخل لدر انتخاب‌شده فهرست می‌شود. نگاشت
          اجباری گرید به ارشدیت وجود ندارد. تغییر انتساب شغلی از این صفحه انجام
          نمی‌شود.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="انتخاب نوع مرجع شغلی"
        className="flex flex-wrap gap-2"
      >
        {TAB_KEYS.map((key) => (
          <button
            key={key}
            id={`${formId}-tab-${key}`}
            type="button"
            role="tab"
            aria-selected={tab === key}
            aria-controls={`${formId}-tabpanel`}
            tabIndex={tab === key ? 0 : -1}
            className={cn(
              "border-b-2 px-3 py-2 text-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => selectTab(key)}
            onKeyDown={(event) => onTabKeyDown(event, key)}
          >
            {TAB_LABEL_FA[key]}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`${formId}-tabpanel`}
        aria-labelledby={`${formId}-tab-${tab}`}
        className="space-y-8"
      >
      <form className="space-y-4" onSubmit={onCreate} noValidate>
        <h3 className="text-body font-medium text-foreground">
          ایجاد {TAB_LABEL_FA[tab]}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-code`} className="text-caption text-muted-foreground">
              کد
            </label>
            <Input
              id={`${formId}-code`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-name`} className="text-caption text-muted-foreground">
              نام فارسی
            </label>
            <Input
              id={`${formId}-name`}
              value={nameFa}
              onChange={(e) => setNameFa(e.target.value)}
              required
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-caption text-muted-foreground">تاریخ شروع</span>
            <JalaliDatePicker
              aria-label="تاریخ شروع اعتبار مرجع شغلی"
              value={startDate}
              onChange={setStartDate}
            />
          </div>
          {tab === "grade" ? (
            <>
              <div className="space-y-1.5">
                <label htmlFor={`${formId}-ladder`} className="text-caption text-muted-foreground">
                  لدر
                </label>
                <select
                  id={`${formId}-ladder`}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={ladderId}
                  onChange={(e) => setLadderId(e.target.value)}
                  required
                >
                  <option value="">انتخاب لدر</option>
                  {laddersForSelect.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nameFa} ({l.code})
                      {!l.active ? " — غیرفعال" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor={`${formId}-rank`} className="text-caption text-muted-foreground">
                  رتبه (نیم‌گرید مجاز، مثلاً ۱۲٫۵)
                </label>
                <Input
                  id={`${formId}-rank`}
                  value={rank}
                  onChange={(e) => setRank(e.target.value)}
                  required
                  inputMode="decimal"
                  autoComplete="off"
                />
              </div>
            </>
          ) : null}
        </div>
        {formError ? (
          <StatusMessage kind="error">{formError}</StatusMessage>
        ) : null}
        <Button type="submit" disabled={creating}>
          {creating ? "در حال ثبت…" : "ایجاد"}
        </Button>
      </form>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-body font-medium text-foreground">
            فهرست {TAB_LABEL_FA[tab]}
            {tab === "grade" && ladderId
              ? " (محدود به لدر انتخاب‌شده)"
              : ""}
          </h3>
          <label className="flex items-center gap-2 text-caption text-muted-foreground">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="size-4 accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            نمایش غیرفعال / تاریخی
          </label>
        </div>

        {tab === "grade" && !ladderId ? (
          <StatusMessage kind="empty">
            ابتدا یک لدر انتخاب کنید تا گریدهای همان لدر نمایش داده شوند.
          </StatusMessage>
        ) : listQuery.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : listQuery.isError ? (
          <StatusMessage kind="error">
            {listQuery.error.message || operationalCopy.jobRefListError}
          </StatusMessage>
        ) : rows.length === 0 ? (
          <StatusMessage kind="empty">
            موردی برای نمایش نیست.
          </StatusMessage>
        ) : (
          <ul className="space-y-2" role="list">
            {rows.map((row) => (
              <li
                key={row.id}
                className={cn(
                  "flex flex-wrap items-center gap-3 border-b border-border/60 py-2",
                  !row.active && "opacity-70",
                )}
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-body font-medium text-foreground">
                    {row.nameFa}
                    {row.rank ? (
                      <span className="ms-2 text-muted-foreground">
                        رتبه {toPersianDigits(row.rank)}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-caption text-muted-foreground">
                    کد: {toPersianDigits(row.code)} · از{" "}
                    {formatJalaliDisplayFromGregorian(row.startDate)}
                    {row.endDateExclusive
                      ? ` تا ${formatJalaliDisplayFromGregorian(row.endDateExclusive)}`
                      : " (باز)"}
                    {!row.active ? " · غیرفعال" : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  {row.active ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busyId === row.id}
                      onClick={() => {
                        setFormError(null);
                        setConfirmDeactivate({ id: row.id, concept: tab });
                      }}
                    >
                      غیرفعال‌سازی
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busyId === row.id}
                      onClick={() => onActivate(row.id)}
                    >
                      فعال‌سازی
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>

      <Dialog
        open={confirmDeactivate !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDeactivate(null);
            setDeactivateEnd(undefined);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأیید غیرفعال‌سازی</DialogTitle>
            <DialogDescription>
              رکورد حذف نمی‌شود؛ بازه اعتبار بسته می‌شود. اگر وابستگی فعال یا
              زمان‌بندی‌شده وجود داشته باشد، عملیات مسدود می‌شود.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <span className="text-caption text-muted-foreground">
              تاریخ پایان اعتبار (انحصاری)
            </span>
            <JalaliDatePicker
              aria-label="تاریخ پایان اعتبار مرجع شغلی"
              value={deactivateEnd}
              onChange={setDeactivateEnd}
            />
          </div>
          {formError ? (
            <StatusMessage kind="error">{formError}</StatusMessage>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmDeactivate(null);
                setDeactivateEnd(undefined);
              }}
            >
              انصراف
            </Button>
            <Button type="button" onClick={confirmDeactivateSubmit}>
              تأیید غیرفعال‌سازی
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
