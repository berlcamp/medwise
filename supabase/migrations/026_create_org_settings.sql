-- =====================================================
-- ORG SETTINGS
-- =====================================================
-- One row per org holding system-wide toggles managed from the super-admin
-- Settings page.
--
-- print_receipts_enabled: when false, the app hides every button that prints
-- a sales invoice or delivery receipt.
--
-- Everyone signed in can read the settings (the app needs them to decide what
-- to render), but only an active super admin can change them.
-- =====================================================

CREATE TABLE IF NOT EXISTS medwise.org_settings (
  org_id INTEGER PRIMARY KEY,
  print_receipts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by INTEGER
);

-- Seed a row for every existing org so the Settings page always has one to update.
INSERT INTO medwise.org_settings (org_id)
SELECT DISTINCT org_id FROM medwise.branches WHERE org_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE medwise.org_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read org settings"
  ON medwise.org_settings;
CREATE POLICY "Authenticated can read org settings"
  ON medwise.org_settings
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Super admin can insert org settings"
  ON medwise.org_settings;
CREATE POLICY "Super admin can insert org settings"
  ON medwise.org_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM medwise.users u
      WHERE u.email = auth.jwt() ->> 'email'
        AND u.type = 'super admin'
        AND u.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "Super admin can update org settings"
  ON medwise.org_settings;
CREATE POLICY "Super admin can update org settings"
  ON medwise.org_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM medwise.users u
      WHERE u.email = auth.jwt() ->> 'email'
        AND u.type = 'super admin'
        AND u.is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM medwise.users u
      WHERE u.email = auth.jwt() ->> 'email'
        AND u.type = 'super admin'
        AND u.is_active = TRUE
    )
  );
