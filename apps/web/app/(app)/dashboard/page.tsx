import { InferenceBulkDemoCard } from "@/components/dashboard/inference-bulk-demo-card";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-2 bg-background p-6 text-foreground">
      <h1 className="text-heading">داشبورد</h1>
      <p className="text-body text-muted-foreground">
        نمای کلی وضعیت کاری شما در اینجا نمایش داده می‌شود.
      </p>
      <InferenceBulkDemoCard />
    </div>
  );
}
