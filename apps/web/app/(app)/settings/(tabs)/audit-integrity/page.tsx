import { renderSettingsDomainPage } from "@/components/settings/settings-domain-page";

/**
 * ممیزی و یکپارچگی — currently zero registry keys.
 * Deep link denied (empty domain never rendered as a tab).
 */
export default function SettingsAuditIntegrityPage() {
  return renderSettingsDomainPage(
    "audit_integrity",
    "/settings/audit-integrity",
  );
}
