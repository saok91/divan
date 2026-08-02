import { renderSettingsDomainPage } from "@/components/settings/settings-domain-page";

export default function SettingsDataRetentionPage() {
  return renderSettingsDomainPage(
    "data_retention",
    "/settings/data-retention",
  );
}
