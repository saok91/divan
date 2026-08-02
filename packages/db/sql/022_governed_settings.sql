-- Governed settings override store (Story 10.1 / FR-60 / AD-7).
-- Schema: app_settings — ordinary platform category (NOT person health / compensation).
-- Raw SQL via pg Pool/PoolClient — not Prisma (AD-6).
-- Migrations-only — do not expand ensure*Schema on request path.
-- Attribution columns foreshadow 10.5 change-control evidence (nullable in 10.1).

CREATE SCHEMA IF NOT EXISTS app_settings;

CREATE TABLE IF NOT EXISTS app_settings.parameter_override (
  parameter_key         TEXT PRIMARY KEY,
  value_json            JSONB NOT NULL,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- 10.5 foreshadow — actor / before / after / reason / effect-time
  updated_by            TEXT,
  reason                TEXT,
  previous_value_json   JSONB,
  effect_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS app_settings_parameter_override_updated_at_idx
  ON app_settings.parameter_override (updated_at DESC);

COMMENT ON TABLE app_settings.parameter_override IS
  'Governed settings overrides (AD-7). Unique parameter_key — no multi-row winners. Code registry remains fail-closed default SoT.';

COMMENT ON COLUMN app_settings.parameter_override.updated_by IS
  'Nullable in 10.1; required attribution path productized in 10.5.';

COMMENT ON COLUMN app_settings.parameter_override.reason IS
  'Nullable in 10.1; change-control reason productized in 10.5.';

COMMENT ON COLUMN app_settings.parameter_override.previous_value_json IS
  'Nullable in 10.1; before-value evidence productized in 10.5.';

COMMENT ON COLUMN app_settings.parameter_override.effect_at IS
  'Nullable in 10.1; effect-time evidence productized in 10.5.';
