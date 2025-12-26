-- Migration 002: Fix illustration_url column to support base64 data URLs
-- Issue: Column was String(1000) but base64 images are ~135KB (135,000 chars)
-- This caused PostgreSQL to silently truncate illustrations

-- Change illustration_url from VARCHAR(1000) to TEXT (unlimited length)
ALTER TABLE pages
ALTER COLUMN illustration_url TYPE TEXT;

-- Add comment for documentation
COMMENT ON COLUMN pages.illustration_url IS 'Base64 data URL for illustration image (can exceed 100KB)';
