/**
 * Governed settings surface access helpers (Story 10.2 / FR-60).
 * Preferred home: audit-envelope (mirrors ops-health / investigation constants).
 * Web stays thin via governedProcedure + soft PermissionSet check.
 */

/** @provisional-pending-AR-ACCESS-freeze — settings surface retrieve */
export const SETTINGS_READ_PERMISSION = "settings.read";

/**
 * Ordinary configuration category — NOT person `health` / HR content.
 * Provisional — AR-DATA / AR-ACCESS pending freeze.
 */
export const SETTINGS_CONFIGURATION_DATA_CATEGORY = "settings.configuration";

export const MSG_SETTINGS_DENIED_FA = "دسترسی ندارید.";
