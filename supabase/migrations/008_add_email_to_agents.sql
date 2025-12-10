-- =====================================================
-- Add email field to agents table
-- =====================================================

-- Add email column to agents table
ALTER TABLE medwise.agents 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Add unique constraint on email
ALTER TABLE medwise.agents 
ADD CONSTRAINT unique_agent_email UNIQUE (email);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_agents_email ON medwise.agents(email);

-- Ensure users table email is also unique (if not already)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_user_email' 
    AND conrelid = 'medwise.users'::regclass
  ) THEN
    ALTER TABLE medwise.users 
    ADD CONSTRAINT unique_user_email UNIQUE (email);
  END IF;
END $$;
