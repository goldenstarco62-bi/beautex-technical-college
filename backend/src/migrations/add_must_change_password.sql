-- Migration script to add must_change_password column to users table
-- This fixes the error: "table users has no column named must_change_password"

-- For SQLite/PostgreSQL
ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 1;

-- Update existing users to have must_change_password = false for superadmin/admin
UPDATE users SET must_change_password = 0 WHERE role IN ('superadmin', 'admin');
