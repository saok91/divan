/**
 * Settings → audit investigation deep-link helpers (Story 10.5).
 * Live filters only — no dead «مشاهده در ممیزی».
 */

export type SettingsAuditHrefInput = {
  /** Exact operation (e.g. settings.apply / settings.reset). */
  operation?: string;
  /** Prefix match (e.g. settings.). */
  operationPrefix?: string;
  /** Optional correlation from mutation result. */
  correlationId?: string | null;
  /** Access-event entity type (e.g. settings_configuration). */
  entityType?: string;
  /** Access-event entity id (parameter key). */
  entityId?: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Build `/audit?...` query for investigation hydrate. */
export function buildSettingsAuditHref(input: SettingsAuditHrefInput): string {
  const params = new URLSearchParams();
  const operation = input.operation?.trim();
  const operationPrefix = input.operationPrefix?.trim();
  const correlationId = input.correlationId?.trim();
  const entityType = input.entityType?.trim();
  const entityId = input.entityId?.trim();

  // Prefer exact operation over prefix when both are supplied.
  if (operation) {
    params.set("operation", operation.slice(0, 200));
  } else if (operationPrefix) {
    params.set("operationPrefix", operationPrefix.slice(0, 200));
  }

  if (correlationId && UUID_RE.test(correlationId)) {
    params.set("correlationId", correlationId);
  }

  if (entityType) {
    params.set("entityType", entityType.slice(0, 120));
  }
  if (entityId) {
    params.set("entityId", entityId.slice(0, 120));
  }

  const qs = params.toString();
  return qs ? `/audit?${qs}` : "/audit";
}

/** After apply — exact operation + correlation when present. */
export function settingsApplyAuditHref(correlationId?: string | null): string {
  return buildSettingsAuditHref({
    operation: "settings.apply",
    correlationId,
  });
}

/** After reset — exact operation + correlation when present. */
export function settingsResetAuditHref(correlationId?: string | null): string {
  return buildSettingsAuditHref({
    operation: "settings.reset",
    correlationId,
  });
}

/**
 * Per-parameter history: settings.* prefix + entity key
 * (access events use entityType=settings_configuration, entityId=parameterKey).
 */
export function settingsHistoryAuditHref(parameterKey: string): string {
  const key = parameterKey.trim().slice(0, 120);
  return buildSettingsAuditHref({
    operationPrefix: "settings.",
    entityType: "settings_configuration",
    entityId: key || undefined,
  });
}
