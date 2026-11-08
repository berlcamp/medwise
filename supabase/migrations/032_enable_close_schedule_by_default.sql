-- =====================================================
-- ORG SETTINGS: SCHEDULED CLOSE ON BY DEFAULT
-- =====================================================
-- Turn the daily scheduled close (default 19:00 -> 07:00 Asia/Manila) on for
-- existing orgs and for any org settings row created later.
-- =====================================================

ALTER TABLE medwise.org_settings
  ALTER COLUMN close_schedule_enabled SET DEFAULT TRUE;

UPDATE medwise.org_settings
SET close_schedule_enabled = TRUE,
    updated_at = NOW();
