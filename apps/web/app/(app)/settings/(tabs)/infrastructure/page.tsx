import { renderSettingsDomainPage } from "@/components/settings/settings-domain-page";

export default function SettingsInfrastructurePage() {
  return renderSettingsDomainPage(
    "infrastructure",
    "/settings/infrastructure",
  );
}
