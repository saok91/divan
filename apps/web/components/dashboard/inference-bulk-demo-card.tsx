"use client";

import { operationalCopy } from "@/lib/operational-copy";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

/**
 * Thin Story 2.7 demo — proves suppress copy vs real count on the shared
 * control plane. Full dashboard remains Epic 5.
 */
export function InferenceBulkDemoCard() {
  const query = api.demoScopedRetrieval.useQuery({
    channel: "dashboard",
  });

  const retrieval = query.data?.retrieval;

  let body: React.ReactNode;
  if (query.isLoading) {
    body = (
      <p role="status" aria-live="polite" className="text-body-medium text-muted-foreground">
        در حال بارگذاری…
      </p>
    );
  } else if (query.isError) {
    body = (
      <p role="alert" className="text-body-medium text-destructive">
        {operationalCopy.accessDeniedTitle}
      </p>
    );
  } else if (retrieval?.outcome === "suppressed") {
    body = (
      <p
        role="status"
        aria-live="polite"
        className="text-body-medium text-foreground"
      >
        {retrieval.messageFa || operationalCopy.suppressedCohort}
      </p>
    );
  } else if (retrieval?.outcome === "empty") {
    body = (
      <p role="status" aria-live="polite" className="text-body-medium text-muted-foreground">
        {operationalCopy.emptySearch}
      </p>
    );
  } else if (retrieval?.outcome === "allowed") {
    body = (
      <p className="text-body-medium text-foreground">
        تعداد مجاز:{" "}
        <span className="font-medium tabular-nums">{retrieval.volume}</span>
      </p>
    );
  } else {
    body = (
      <p role="alert" className="text-body-medium text-destructive">
        {retrieval?.messageFa ?? operationalCopy.accessDeniedTitle}
      </p>
    );
  }

  return (
    <section
      aria-labelledby="inference-bulk-demo-heading"
      className={cn("mt-6 space-y-2 border-t border-border pt-4")}
    >
      <h2 id="inference-bulk-demo-heading" className="text-heading-sm">
        نمونه کنترل استنباط (دمو)
      </h2>
      <p className="text-body text-muted-foreground">
        کارت‌ها هرگز صفر جعلی نشان نمی‌دهند؛ سرکوب با متن مشخص است.
      </p>
      <div
        tabIndex={0}
        className="rounded-md border border-border p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {body}
      </div>
    </section>
  );
}
