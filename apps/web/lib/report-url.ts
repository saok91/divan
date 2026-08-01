/**
 * Shareable reports workspace URL helpers (Story 9.5).
 *
 * Identity (path): `/reports/{subject}` or `/reports/{subject}/{reportKey}`
 * State (query): evaluationMode, asOf, teamId, rangeStart, rangeEnd, run=1
 *
 * Import catalogue-only subpath — never `@divan/reporting` barrel (pulls pg / DB).
 */
import {
  isLaunchReportKey,
  reportsForSubject,
  type LaunchReportKey,
  type ReportSubject,
} from "@divan/reporting/catalogue";

import type { ReportFilterState } from "@/components/reports/report-filters";

export type ReportUrlFilterState = ReportFilterState & {
  run: boolean;
};

export type { LaunchReportKey, ReportSubject };

function isReportKeyForSubject(
  reportKey: string,
  subject: ReportSubject,
): reportKey is LaunchReportKey {
  return (
    isLaunchReportKey(reportKey) &&
    reportsForSubject(subject).some((d) => d.key === reportKey)
  );
}

export function reportKeyFromPathname(
  pathname: string,
  subject: ReportSubject,
): LaunchReportKey | null {
  const prefix = `/reports/${subject}`;
  if (pathname === prefix) return null;
  if (!pathname.startsWith(`${prefix}/`)) return null;
  const rest = pathname.slice(prefix.length + 1);
  const segment = rest.split("/")[0]?.trim() ?? "";
  return isReportKeyForSubject(segment, subject) ? segment : null;
}

export function buildReportPath(
  subject: ReportSubject,
  reportKey?: string | null,
): string {
  if (reportKey && isReportKeyForSubject(reportKey, subject)) {
    return `/reports/${subject}/${reportKey}`;
  }
  return `/reports/${subject}`;
}

export function parseReportSearchParams(
  searchParams: URLSearchParams,
  defaults: { rangeStart: string; rangeEnd: string },
): ReportUrlFilterState {
  const modeRaw = searchParams.get("evaluationMode");
  const evaluationMode =
    modeRaw === "as_of" || modeRaw === "current" ? modeRaw : "current";
  const asOf = searchParams.get("asOf")?.trim() || undefined;
  const teamId = searchParams.get("teamId")?.trim() || "";
  const rangeStart =
    searchParams.get("rangeStart")?.trim() || defaults.rangeStart;
  const rangeEnd = searchParams.get("rangeEnd")?.trim() || defaults.rangeEnd;
  const run = searchParams.get("run") === "1";

  return {
    teamId,
    evaluationMode,
    asOfDate: evaluationMode === "as_of" ? asOf : undefined,
    rangeStart,
    rangeEnd,
    run,
  };
}

export function buildReportSearchParams(state: {
  evaluationMode: "current" | "as_of";
  asOfDate?: string;
  teamId?: string;
  rangeStart?: string;
  rangeEnd?: string;
  run?: boolean;
}): string {
  const sp = new URLSearchParams();
  if (state.evaluationMode && state.evaluationMode !== "current") {
    sp.set("evaluationMode", state.evaluationMode);
  }
  if (state.evaluationMode === "as_of" && state.asOfDate?.trim()) {
    sp.set("asOf", state.asOfDate.trim());
  }
  if (state.teamId?.trim()) {
    sp.set("teamId", state.teamId.trim());
  }
  if (state.rangeStart?.trim()) {
    sp.set("rangeStart", state.rangeStart.trim());
  }
  if (state.rangeEnd?.trim()) {
    sp.set("rangeEnd", state.rangeEnd.trim());
  }
  if (state.run) {
    sp.set("run", "1");
  }
  return sp.toString();
}

export function reportHref(args: {
  subject: ReportSubject;
  reportKey?: string | null;
  filters: ReportFilterState;
  run?: boolean;
}): string {
  const path = buildReportPath(args.subject, args.reportKey);
  const qs = buildReportSearchParams({
    ...args.filters,
    run: args.run === true,
  });
  return qs ? `${path}?${qs}` : path;
}
