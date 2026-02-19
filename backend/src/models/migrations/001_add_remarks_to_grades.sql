-- Migration to add remarks to grades table
ALTER TABLE grades ADD COLUMN remarks TEXT;
