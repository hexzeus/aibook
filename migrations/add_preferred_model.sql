-- Migration: Add preferred_model column to users table
-- Date: 2025-12-19
-- Description: Adds support for users to choose between Claude and OpenAI models

-- Add preferred_model column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS preferred_model VARCHAR(50) DEFAULT 'claude';

-- Add comment for documentation
COMMENT ON COLUMN users.preferred_model IS 'User preferred AI model: claude or openai';

-- Create index for faster lookups (optional, but helpful for analytics)
CREATE INDEX IF NOT EXISTS idx_users_preferred_model ON users(preferred_model);
