-- =====================================================
-- USERS: PER-USER MODULE ACCESS
-- =====================================================
-- List of module keys the user may open (see MODULE_ACCESS_OPTIONS in
-- lib/constants). NULL means "all modules", so existing accounts keep their
-- current access until edited.
-- =====================================================

ALTER TABLE medwise.users
  ADD COLUMN IF NOT EXISTS module_access TEXT[];
