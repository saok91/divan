import { readFileSync } from "node:fs";

/**
 * Sensitive category registry hooks (Story 2.2 / FR-3).
 *
 * Production enablement is owned by AR-DATA disposition — do not invent the
 * launch field matrix here. Unknown / disabled categories are non-grantable
 * (fail-closed) even if a policy rule somehow mentions them.
 *
 * Layer order in authorize: **category registry gate first**, then policy
 * exact-match (permission × dataCategory × action × organizationalScope).
 *
 * Routine System Admin path = identity/config/health only. HR-content
 * elevation is break-glass (Story 2.5): minimal PermissionSet binding via
 * EntitlementGrant kind=break_glass — not a blanket SysAdmin allow here.
 */

export type CategorySensitivity = "ordinary" | "sensitive";

export type SensitiveCategory = {
  /** Stable category id (e.g. `compensation`, `demo.sensitive_hr`). */
  id: string;
  /** false until AR-DATA disposition enables the category. */
  enabled: boolean;
  sensitivity?: CategorySensitivity;
  /**
   * Documentation flag: export always needs a separate `action: "export"`
   * allow rule — never implied by read.
   */
  requiresSeparateExport?: boolean;
};

export type CategoryRegistry = {
  categories: readonly SensitiveCategory[];
};

function freezeCategory(entry: SensitiveCategory): SensitiveCategory {
  return Object.freeze({ ...entry });
}

function freezeRegistry(
  categories: readonly SensitiveCategory[],
): CategoryRegistry {
  return Object.freeze({
    categories: Object.freeze(categories.map(freezeCategory)),
  });
}

/**
 * Known production-sensitive hooks — all default `enabled: false`.
 * Local/dev may enable **only** demo categories via `DEV_DEMO_CATEGORIES`.
 */
export const PRODUCTION_SENSITIVE_CATEGORY_HOOKS: readonly SensitiveCategory[] =
  freezeRegistry([
    {
      id: "compensation",
      enabled: false,
      sensitivity: "sensitive",
      requiresSeparateExport: true,
    },
    {
      id: "identity.national_id",
      enabled: false,
      sensitivity: "sensitive",
      requiresSeparateExport: true,
    },
    {
      id: "religion",
      enabled: false,
      sensitivity: "sensitive",
      requiresSeparateExport: true,
    },
    {
      id: "health",
      enabled: false,
      sensitivity: "sensitive",
      requiresSeparateExport: true,
    },
    {
      id: "family",
      enabled: false,
      sensitivity: "sensitive",
      requiresSeparateExport: true,
    },
    {
      id: "bank",
      enabled: false,
      sensitivity: "sensitive",
      requiresSeparateExport: true,
    },
    {
      id: "insurance",
      enabled: false,
      sensitivity: "sensitive",
      requiresSeparateExport: true,
    },
  ]).categories;

/** Empty registry — every category id is unknown → non-grantable. */
export function emptyCategoryRegistry(): CategoryRegistry {
  return freezeRegistry([]);
}

/**
 * Dev/selfcheck fixture: production-sensitive hooks stay disabled;
 * only demo categories are enabled for omit / read≠export proofs.
 * Never enables religion/health/family/bank/insurance/national-ID/compensation.
 */
export const DEV_DEMO_CATEGORIES: CategoryRegistry = freezeRegistry([
  ...PRODUCTION_SENSITIVE_CATEGORY_HOOKS,
  {
    id: "demo.non_hr",
    enabled: true,
    sensitivity: "ordinary",
    requiresSeparateExport: false,
  },
  {
    id: "demo.sensitive_hr",
    enabled: true,
    sensitivity: "sensitive",
    requiresSeparateExport: true,
  },
  {
    id: "identity.access_admin",
    enabled: true,
    sensitivity: "ordinary",
    requiresSeparateExport: false,
  },
  {
    id: "identity.person",
    enabled: true,
    sensitivity: "ordinary",
    requiresSeparateExport: false,
  },
  {
    id: "organization.unit",
    enabled: true,
    sensitivity: "ordinary",
    requiresSeparateExport: false,
  },
  {
    id: "organization.job_reference",
    enabled: true,
    sensitivity: "ordinary",
    requiresSeparateExport: false,
  },
  {
    id: "organization.headcount_approval",
    enabled: true,
    sensitivity: "ordinary",
    requiresSeparateExport: false,
  },
  {
    id: "organization.headcount_exemption",
    enabled: true,
    sensitivity: "ordinary",
    requiresSeparateExport: false,
  },
  {
    id: "organization.headcount_override",
    enabled: true,
    sensitivity: "ordinary",
    requiresSeparateExport: false,
  },
  // Story 7.1 — provisional audit investigation category (AR-DATA pending freeze)
  {
    id: "audit.evidence",
    enabled: true,
    sensitivity: "sensitive",
    requiresSeparateExport: true,
  },
]);

/**
 * True only when the category is registered **and** enabled.
 * Unknown id → false (fail-closed). Disabled → false even with a policy rule.
 */
export function isCategoryGrantable(
  registry: CategoryRegistry,
  categoryId: string,
): boolean {
  const entry = registry.categories.find((c) => c.id === categoryId);
  if (!entry) return false;
  return entry.enabled === true;
}

function isDevFixtureDisabled(env: NodeJS.ProcessEnv): boolean {
  return env.AUDIT_ENVELOPE_USE_DEV_FIXTURE?.trim().toLowerCase() === "false";
}

/**
 * Parse `{ categories: [...] }` — fail-closed on bad shape, invalid entries,
 * or duplicate ids (return empty registry).
 */
function parseCategoryList(raw: unknown): CategoryRegistry {
  if (!Array.isArray(raw)) return emptyCategoryRegistry();

  const seen = new Set<string>();
  const categories: SensitiveCategory[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") return emptyCategoryRegistry();
    const rec = entry as Record<string, unknown>;
    if (typeof rec.id !== "string" || rec.id.length === 0) {
      return emptyCategoryRegistry();
    }
    if (typeof rec.enabled !== "boolean") return emptyCategoryRegistry();
    if (seen.has(rec.id)) return emptyCategoryRegistry();
    seen.add(rec.id);

    const next: SensitiveCategory = {
      id: rec.id,
      enabled: rec.enabled,
    };
    if (
      rec.sensitivity === "ordinary" ||
      rec.sensitivity === "sensitive"
    ) {
      next.sensitivity = rec.sensitivity;
    }
    if (typeof rec.requiresSeparateExport === "boolean") {
      next.requiresSeparateExport = rec.requiresSeparateExport;
    }
    categories.push(next);
  }

  return freezeRegistry(categories);
}

/**
 * Load category registry.
 * - `AUDIT_ENVELOPE_CATEGORY_PATH` → JSON `{ "categories": [...] }`
 * - `AUDIT_ENVELOPE_USE_DEV_FIXTURE=false` (case-insensitive) → empty (all non-grantable)
 * - otherwise non-production → DEV_DEMO_CATEGORIES; production → production hooks only (all disabled)
 *
 * Fail-closed: unreadable/invalid file, bad shape, invalid entries, or
 * duplicate ids → empty registry.
 */
export function loadCategoryRegistry(
  env: NodeJS.ProcessEnv = process.env,
): CategoryRegistry {
  const path = env.AUDIT_ENVELOPE_CATEGORY_PATH?.trim();
  if (path) {
    try {
      const raw = readFileSync(path, "utf8");
      const parsed = JSON.parse(raw) as { categories?: unknown };
      return parseCategoryList(parsed?.categories);
    } catch {
      return emptyCategoryRegistry();
    }
  }

  if (isDevFixtureDisabled(env)) {
    return emptyCategoryRegistry();
  }

  if ((env.NODE_ENV ?? "").toLowerCase() === "production") {
    return freezeRegistry([...PRODUCTION_SENSITIVE_CATEGORY_HOOKS]);
  }

  return DEV_DEMO_CATEGORIES;
}
