import { PageHeader } from "@/components/page-header";
import { ReportCataloguePanel } from "@/components/reports/report-catalogue-panel";

export default function ReportsPage() {
  return (
    <div className="mx-auto max-w-[90rem] space-y-4 bg-surface-page text-text-primary">
      <PageHeader
        breadcrumb={
          <span>
            دیوان
            <span className="mx-1 text-text-tertiary" aria-hidden>
              /
            </span>
            گزارش‌ها
          </span>
        }
        title="گزارش‌ها"
        purpose="کاتالوگ گزارش‌های راه‌اندازی با فیلتر مشترک سازمان و زمان — مشاهده فقط؛ خروجی حاکمیتی در داستان ۶٫۵."
      />
      <div className="px-content-padding-inline pb-6">
        <ReportCataloguePanel />
      </div>
    </div>
  );
}
