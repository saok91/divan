import { DashboardPanel } from "@/components/dashboard/dashboard-panel";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-[90rem] space-y-4 bg-background p-6 text-foreground">
      <div className="space-y-1">
        <h1 className="text-heading">داشبورد</h1>
        <p className="text-body text-muted-foreground">
          شاخص‌های نیروی کار با فیلتر مشترک سازمان و زمان — هماهنگ با فهرست و
          ظرفیت.
        </p>
      </div>
      <DashboardPanel />
    </div>
  );
}
