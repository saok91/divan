import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <section className="space-y-6 p-4" aria-busy="true" aria-label="در حال بارگذاری صفحه">
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-72 max-w-full" />
      </div>
      <div className="space-y-2" aria-hidden="true">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-8 w-full" />)}
      </div>
      <p role="status" className="text-caption text-muted-foreground">در حال آماده‌سازی اطلاعات…</p>
    </section>
  );
}
