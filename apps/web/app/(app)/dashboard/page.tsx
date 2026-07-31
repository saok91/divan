import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { PageHeader } from "@/components/page-header";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-[90rem] space-y-4 bg-surface-page text-text-primary">
      <PageHeader
        breadcrumb={
          <span>
            دیوان
            <span className="mx-1 text-text-tertiary" aria-hidden>
              /
            </span>
            داشبورد
          </span>
        }
        title="داشبورد"
        purpose="شاخص‌های نیروی کار با فیلتر مشترک سازمان و زمان — هماهنگ با فهرست و ظرفیت."
      />
      <div className="px-content-padding-inline pb-6">
        <DashboardPanel />
      </div>
    </div>
  );
}
