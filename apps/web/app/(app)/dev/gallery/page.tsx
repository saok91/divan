"use client";

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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RowActionButton } from "@/components/ui/row-action-button";
import { RowActionCluster } from "@/components/ui/row-action-overflow";

import { EntityPickerGalleryDemos } from "./entity-picker-demos";

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

      <section className="space-y-2 px-content-padding-inline" aria-labelledby="gallery-stubs">
        <h2 id="gallery-stubs" className="text-heading-sm">
          Stub slots
        </h2>
        <p className="text-caption text-text-tertiary">skeleton — Story 8.8</p>
      </section>
    </div>
  );
}
