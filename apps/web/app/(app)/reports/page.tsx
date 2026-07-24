import { ReportCataloguePanel } from "@/components/reports/report-catalogue-panel";

export default function ReportsPage() {
  return (
    <div className="mx-auto max-w-[90rem] space-y-4 bg-background p-6 text-foreground">
      <div className="space-y-1">
        <h1 className="text-heading">گزارش‌ها</h1>
        <p className="text-body text-muted-foreground">
          کاتالوگ گزارش‌های راه‌اندازی با فیلتر مشترک سازمان و زمان — مشاهده
          فقط؛ خروجی حاکمیتی در داستان ۶٫۵.
        </p>
      </div>
      <ReportCataloguePanel />
    </div>
  );
}
