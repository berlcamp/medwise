-- =====================================================
-- ORG SETTINGS: SCHEDULED SYSTEM CLOSE
-- =====================================================
-- When close_schedule_enabled is true the system is closed every day between
-- close_start_time and close_end_time (Asia/Manila). A range that crosses
-- midnight (e.g. 19:00 -> 07:00) closes overnight. Same bypass rules as
-- system_closed: super admins and SYSTEM_SETTINGS_EMAILS can still use it.
-- =====================================================

ALTER TABLE medwise.org_settings
  ADD COLUMN IF NOT EXISTS close_schedule_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS close_start_time TIME NOT NULL DEFAULT '19:00',
  ADD COLUMN IF NOT EXISTS close_end_time TIME NOT NULL DEFAULT '07:00';
