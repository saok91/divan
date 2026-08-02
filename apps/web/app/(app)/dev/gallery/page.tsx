"use client";

import { useState, useEffect } from "react";
import { notFound } from "next/navigation";
import {
  CalendarPlus,
  CircleCheck,
  Copy,
  Ellipsis,
  ExternalLink,
  Eye,
  FileSearch,
  ListFilter,
  MapPinned,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
} from "lucide-react";
import { useTheme } from "next-themes";

import {
  FormField,
  FormFooter,
  FormLayout,
  FormSection,
} from "@/components/form-layout";
import {
  FullBleedTableHost,
  Panel,
  PanelSection,
} from "@/components/layout/panel-section";
import { PageHeader } from "@/components/page-header";
import { SectionTabs } from "@/components/section-tabs";
import { TableSkeleton } from "@/components/governed-data-table";
import { GlossaryTerm } from "@/components/glossary/glossary-term";
import { usePlatformStatus } from "@/components/platform-status-provider";
import { StaleRecalcBanner } from "@/components/stale-recalc-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { Input } from "@/components/ui/input";
import { PendingSurface, pendingLabel } from "@/components/ui/pending-surface";
import { RowActionButton } from "@/components/ui/row-action-button";
import { RowActionCluster } from "@/components/ui/row-action-overflow";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toastBackground } from "@/components/ui/toast";
import { operationalCopy } from "@/lib/operational-copy";
import {
  CHART_CATEGORICAL_DARK,
  CHART_CATEGORICAL_LIGHT,
  CHART_SEQUENTIAL,
} from "@/lib/chart-tokens";
import {
  CategoricalBarChart,
  CategoricalLineChart,
} from "@/components/charts";

import { EntityPickerGalleryDemos } from "./entity-picker-demos";

function GalleryStaleBannerDemo() {
  const {
    setRecalculationPending,
    setAffectedPersonCount,
    recalculationPending,
  } = usePlatformStatus();

  return (
    <div className="space-y-2 rounded-sm border border-hairline p-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setAffectedPersonCount(3);
            setRecalculationPending(true);
          }}
        >
          فعال‌سازی بنر نمونه
        </Button>
        <Button
          type="button"
          variant="tertiary"
          size="sm"
          onClick={() => {
            setRecalculationPending(false);
            setAffectedPersonCount(0);
          }}
          disabled={!recalculationPending}
          disabledReason="بنر نمونه فعال نیست."
        >
          خاموش کردن
        </Button>
      </div>
      <StaleRecalcBanner />
    </div>
  );
}
/**
 * Dev-only living reference for layout primitives (Story 8.2).
 * Gated out of production builds.
 */
export default function DevGalleryPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div className="space-y-8 bg-surface-page pb-16 text-text-primary">
      <PageHeader
        breadcrumb={
          <span>
            دیوان
            <span className="mx-1 text-text-tertiary" aria-hidden>
              /
            </span>
            توسعه
            <span className="mx-1 text-text-tertiary" aria-hidden>
              /
            </span>
            گالری
          </span>
        }
        title="گالری اجزای چیدمان"
        purpose="مرجع زندهٔ توکن‌ها و primitives داستان ۸٫۲ — فقط محیط توسعه."
        resultCount="dev"
      />

      <div className="flex flex-wrap items-center gap-2 px-content-padding-inline">
        <span className="text-caption text-text-secondary">تم:</span>
        <Button
          type="button"
          variant="tertiary"
          size="sm"
          onClick={() => setTheme("light")}
          aria-pressed={resolvedTheme === "light"}
          disabled={resolvedTheme == null}
        >
          روشن
        </Button>
        <Button
          type="button"
          variant="tertiary"
          size="sm"
          onClick={() => setTheme("dark")}
          aria-pressed={resolvedTheme === "dark"}
          disabled={resolvedTheme == null}
        >
          تیره
        </Button>
      </div>

      <section className="space-y-3 px-content-padding-inline" aria-labelledby="gallery-tabs">
        <h2 id="gallery-tabs" className="text-heading-sm">
          Section tabs
        </h2>
        <SectionTabs
          ariaLabel="نمونه‌های تب بخش"
          tabs={[
            { id: "a", label: "فعال", href: "/dev/gallery" },
            { id: "b", label: "غیرفعال", href: "/dev/gallery#other" },
          ]}
        />
      </section>

      <section className="space-y-3 px-content-padding-inline" aria-labelledby="gallery-buttons">
        <h2 id="gallery-buttons" className="text-heading-sm">
          Button family (8.1)
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="tertiary">Tertiary</Button>
          <RowActionButton
            label="ویرایش"
            icon={Pencil}
            onClick={() => undefined}
          />
          <Button variant="destructive">Destructive</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-caption text-text-tertiary w-full">
            Row actions — icon-only + tooltip; overflow when &gt;2
          </p>
          <RowActionCluster
            actions={[
              {
                id: "edit",
                label: "اطلاعات کامل/ویرایش",
                icon: Pencil,
                onSelect: () => undefined,
              },
              {
                id: "register",
                label: "ثبت رویداد",
                icon: CalendarPlus,
                onSelect: () => undefined,
              },
              {
                id: "roles",
                label: "تخصیص نقش",
                icon: Shield,
                onSelect: () => undefined,
              },
              {
                id: "scopes",
                label: "محدوده",
                icon: MapPinned,
                onSelect: () => undefined,
              },
              {
                id: "activate",
                label: "فعال‌سازی",
                icon: CircleCheck,
                onSelect: () => undefined,
              },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <p className="text-caption text-text-tertiary">xs 24</p>
            <Button size="xs" variant="tertiary">
              xs
            </Button>
          </div>
          <div className="space-y-1">
            <p className="text-caption text-text-tertiary">sm 28</p>
            <Button size="sm" variant="tertiary">
              sm
            </Button>
          </div>
          <div className="space-y-1">
            <p className="text-caption text-text-tertiary">default 32</p>
            <Button size="default" variant="tertiary">
              default
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="gallery-type">
        <h2
          id="gallery-type"
          className="text-heading-sm px-content-padding-inline"
        >
          Typography roles
        </h2>
        <div className="space-y-2 px-content-padding-inline">
          <p className="text-heading">heading</p>
          <p className="text-heading-sm">heading-sm</p>
          <p className="text-body">body</p>
          <p className="text-body-medium">body-medium</p>
          <p className="text-caption">caption</p>
          <p className="text-tabular">tabular ۱۲۳٬۴۵۶</p>
          <p className="text-column-header">column-header</p>
          <p className="text-field-label">field-label</p>
          <p className="text-identifier">identifier-uuid</p>
        </div>
      </section>

      <section className="space-y-3 px-content-padding-inline" aria-labelledby="gallery-icons">
        <h2 id="gallery-icons" className="text-heading-sm">
          Icons (canonical map 8.7)
        </h2>
        <p className="text-caption text-text-secondary">
          See{" "}
          <span className="text-identifier">components/icons/icon-contract.md</span>
        </p>
        <div className="flex flex-wrap gap-4 text-text-secondary">
          <Pencil className="size-3" aria-label="edit" />
          <CalendarPlus className="size-3" aria-label="register-event" />
          <Shield className="size-3" aria-label="roles" />
          <MapPinned className="size-3" aria-label="scopes" />
          <CircleCheck className="size-3" aria-label="activate" />
          <Eye className="size-3" aria-label="details" />
          <FileSearch className="size-3" aria-label="view-report" />
          <Trash2 className="size-3" aria-label="delete" />
          <Plus className="size-4" aria-label="add" />
          <ListFilter className="size-4" aria-label="filter" />
          <Ellipsis className="size-4" aria-label="more" />
          <Copy className="size-3" aria-label="copy" />
          <ExternalLink className="size-4" aria-label="external" />
          <Search className="size-4" aria-label="search" />
        </div>
      </section>

      <section className="space-y-3 px-content-padding-inline" aria-labelledby="gallery-panel">
        <h2 id="gallery-panel" className="text-heading-sm">
          Panel / section
        </h2>
        <Panel>
          <PanelSection title="بخش اول">
            <p className="text-body text-text-secondary px-content-padding-inline">
              پنل برای فرم و محتوای گروه‌بندی‌شده — نه برای جدول فهرست.
            </p>
          </PanelSection>
          <PanelSection title="بخش دوم">
            <p className="text-caption text-text-tertiary px-content-padding-inline">
              جداکنندهٔ hairline؛ بدون کارت تو در تو.
            </p>
          </PanelSection>
        </Panel>
        <FullBleedTableHost>
          <div className="border-y border-hairline py-2 text-caption text-text-secondary">
            Full-bleed table host — فقط gutter؛ بدون کارت.
          </div>
        </FullBleedTableHost>
      </section>

      <section aria-labelledby="gallery-form">
        <h2
          id="gallery-form"
          className="text-heading-sm px-content-padding-inline mb-2"
        >
          Form layout
        </h2>
        <FormLayout>
          <FormSection title="نمونه فیلدها">
            <FormField label="نام" htmlFor="gallery-name" required help="متن راهنما">
              <Input id="gallery-name" />
            </FormField>
            <FormField label="کد" htmlFor="gallery-code" error="خطای نمونه">
              <Input id="gallery-code" dir="ltr" aria-invalid />
            </FormField>
          </FormSection>
          <FormFooter>
            <Button type="button" variant="ghost">
              انصراف
            </Button>
            <Button type="button" variant="secondary">
              ذخیره پیش‌نویس
            </Button>
            <Button type="button" variant="primary">
              نهایی‌سازی
            </Button>
          </FormFooter>
        </FormLayout>
      </section>

      <EntityPickerGalleryDemos />

      <section
        className="space-y-4 px-content-padding-inline"
        aria-labelledby="gallery-operational-copy"
      >
        <h2 id="gallery-operational-copy" className="text-heading-sm">
          Self-explaining state &amp; operational copy (Story 8.9)
        </h2>
        <p className="text-caption text-text-secondary">
          Recalc banner disclosure, empty taxonomy, glossary, muted figure,
          disabled-with-reason.
        </p>

        <div className="space-y-2">
          <p className="text-field-label">Stale recalc banner (force via provider)</p>
          <GalleryStaleBannerDemo />
        </div>

        <div className="space-y-2">
          <p className="text-field-label">Empty taxonomy</p>
          <EmptyState kind="noDataYet" noDataYetBodyFa={operationalCopy.personListEmpty} />
          <EmptyState kind="filtered" onAction={() => undefined} />
          <EmptyState kind="notPermitted" />
        </div>

        <div className="space-y-2">
          <p className="text-field-label">Glossary term</p>
          <GlossaryTerm termKey="currentState" />
          <GlossaryTerm termKey="breakGlass" />
        </div>

        <div className="space-y-2">
          <p className="text-field-label">Muted pending figure</p>
          <p className="text-body text-text-tertiary" role="status">
            {operationalCopy.figureRecalculating}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-field-label">Disabled with reason</p>
          <Button
            type="button"
            variant="primary"
            disabled
            disabledReason={operationalCopy.staleGoldCtaHint}
          >
            نهایی‌سازی
          </Button>
        </div>
      </section>

      <section
        className="space-y-4 px-content-padding-inline"
        aria-labelledby="gallery-feedback"
      >
        <h2 id="gallery-feedback" className="text-heading-sm">
          Feedback, loading &amp; motion (Story 8.8)
        </h2>
        <p className="text-caption text-text-secondary">
          Precedence: inline → toast (background only) → banner. Pulse skeleton
          (opacity); static under{" "}
          <code className="text-identifier">prefers-reduced-motion</code>. See{" "}
          <code className="text-identifier">components/feedback/FEEDBACK.md</code>
          .
        </p>

        <div className="space-y-2">
          <p className="text-field-label">Skeleton pulse</p>
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>

        <div className="space-y-2">
          <p className="text-field-label">TableSkeleton</p>
          <Table aria-label="نمونه اسکلت جدول" className="w-full">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-column-header">کد</TableHead>
                <TableHead className="text-column-header">نام</TableHead>
                <TableHead className="text-column-header">نقش</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableSkeleton columnCount={3} rowCount={4} density="dense" />
            </TableBody>
          </Table>
        </div>

        <div className="space-y-2">
          <p className="text-field-label">FeedbackMessage (inline)</p>
          <FeedbackMessage kind="pending">
            {operationalCopy.actionPending}
          </FeedbackMessage>
          <FeedbackMessage kind="error">خطای نمونه — فقط اینلاین</FeedbackMessage>
          <FeedbackMessage kind="success">
            نتیجهٔ تأییدشده از سرور (نه خوش‌بینانه)
          </FeedbackMessage>
        </div>

        <GalleryPendingDemo />

        <div className="space-y-2">
          <p className="text-field-label">
            Toast — background work only (not for form save)
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              toastBackground({
                message: operationalCopy.importExecuteSuccess,
                href: "/import",
                hrefLabel: operationalCopy.importToastBatchLink,
              })
            }
          >
            نمایش toast پس‌زمینه
          </Button>
        </div>
      </section>

      <section
        className="space-y-4 px-content-padding-inline"
        aria-labelledby="gallery-charts"
        data-slot="gallery-charts"
      >
        <h2 id="gallery-charts" className="text-heading-sm">
          Chart tokens &amp; chrome (Story 9.10 / UX-DR40)
        </h2>
        <p className="text-caption text-muted-foreground">
          Categorical (theme-aware) · sequential ramp · sample line/bar using
          shared SVG chrome. Gold/status hues never appear as series.
        </p>
        <div className="space-y-2">
          <p className="text-field-label">Categorical swatches (CSS vars)</p>
          <div className="flex flex-wrap gap-2">
            {CHART_CATEGORICAL_LIGHT.map((_, i) => (
              <div
                key={i}
                className="flex h-8 w-16 items-center justify-center rounded-sm text-caption text-chrome-foreground"
                style={{
                  backgroundColor: `var(--chart-categorical-${i + 1})`,
                }}
                title={`categorical-${i + 1}`}
              >
                {i + 1}
              </div>
            ))}
          </div>
          <p className="text-caption text-muted-foreground" dir="ltr">
            light SoT: {CHART_CATEGORICAL_LIGHT.join(", ")} · dark SoT:{" "}
            {CHART_CATEGORICAL_DARK.join(", ")}
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-field-label">Sequential ramp</p>
          <div className="flex flex-wrap gap-1">
            {CHART_SEQUENTIAL.map((hex, i) => (
              <div
                key={hex}
                className="h-8 w-10 rounded-sm border border-hairline"
                style={{ backgroundColor: `var(--chart-sequential-${i + 1})` }}
                title={hex}
              />
            ))}
          </div>
        </div>
        <div className="max-w-xl space-y-4 border-t border-hairline pt-4">
          <CategoricalLineChart
            aria-label="نمونه روند"
            seriesLabels={["شروع", "خاتمه"]}
            points={[
              { label: "1403-07", values: [4, 2] },
              { label: "1403-08", values: [6, 3] },
              { label: "1403-09", values: [5, 5] },
              { label: "1403-10", values: [8, 4] },
            ]}
          />
          <CategoricalBarChart
            aria-label="نمونه توزیع"
            seriesLabel="تعداد"
            data={[
              { label: "نقش", value: 12 },
              { label: "گرید", value: 8 },
              { label: "همکاری", value: 5 },
            ]}
          />
        </div>
      </section>
    </div>
  );
}

function GalleryPendingDemo() {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!pending) return;
    const id = window.setTimeout(() => setPending(false), 1500);
    return () => window.clearTimeout(id);
  }, [pending]);

  return (
    <PendingSurface pending={pending} className="space-y-2">
      <p className="text-field-label">In-place pending</p>
      <Button
        type="button"
        variant="primary"
        disabled={pending}
        disabledReason={pending ? operationalCopy.actionPending : undefined}
        onClick={() => {
          setPending(true);
        }}
      >
        {pendingLabel(
          pending,
          "ذخیره نمونه",
          operationalCopy.actionSaving,
        )}
      </Button>
    </PendingSurface>
  );
}
