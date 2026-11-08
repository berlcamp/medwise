-- =====================================================
-- ORG SETTINGS: CLOSE THE SYSTEM
-- =====================================================
-- system_closed: when true, only super admins and the accounts listed in
-- SYSTEM_SETTINGS_EMAILS (lib/constants) can use the app; everyone else sees
-- a "system is closed" screen after signing in.
-- system_closed_message: optional text shown on that screen.
--
-- Also lets nelbertgwapitos@gmail.com manage org settings alongside super
-- admins. Keep this email list in sync with SYSTEM_SETTINGS_EMAILS.
-- =====================================================

ALTER TABLE medwise.org_settings
  ADD COLUMN IF NOT EXISTS system_closed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS system_closed_message TEXT;

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
        AND u.is_active = TRUE
        AND (
          u.type = 'super admin'
          OR lower(u.email) IN ('nelbertgwapitos@gmail.com')
        )
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
        AND u.is_active = TRUE
        AND (
          u.type = 'super admin'
          OR lower(u.email) IN ('nelbertgwapitos@gmail.com')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM medwise.users u
      WHERE u.email = auth.jwt() ->> 'email'
        AND u.is_active = TRUE
        AND (
          u.type = 'super admin'
          OR lower(u.email) IN ('nelbertgwapitos@gmail.com')
        )
    )
  );
