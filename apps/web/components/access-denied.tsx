import Link from "next/link";

import { operationalCopy } from "@/lib/operational-copy";

type AccessDeniedProps = {
  landingPath: string;
};

/** Deep-link denial surface (UX-DR18) — exact operational copy. */
export function AccessDenied({ landingPath }: AccessDeniedProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-4 bg-background p-6 text-foreground">
      <h1 className="text-heading">{operationalCopy.accessDeniedTitle}</h1>
      <p className="text-body text-muted-foreground">
        {operationalCopy.accessDeniedBody}
      </p>
      <p>
        <Link
          href={landingPath}
          className="text-body-medium text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {operationalCopy.accessDeniedReturn}
        </Link>
      </p>
    </div>
  );
}
