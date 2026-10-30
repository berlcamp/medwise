-- =====================================================
-- USERS: PER-USER REPORT ACCESS
-- =====================================================
-- List of report tab keys the user may open on the Reports page (see
-- REPORT_ACCESS_OPTIONS in lib/constants). NULL means "use the role default",
-- so existing accounts keep their current access until edited.
-- =====================================================

ALTER TABLE medwise.users
  ADD COLUMN IF NOT EXISTS report_access TEXT[];
