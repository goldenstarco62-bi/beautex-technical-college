-- Migration: 002_add_material_metadata_columns.sql
-- Purpose: Add file_name, file_size, and mime_type columns to course_materials table.
-- These columns were added to the schema after the table was initially created in production.
-- Run this once in your Supabase SQL Editor to fix the production database.
-- Safe to run multiple times (uses IF NOT EXISTS check via DO block).

DO $$
BEGIN
    -- Add file_name column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'course_materials' AND column_name = 'file_name'
    ) THEN
        ALTER TABLE course_materials ADD COLUMN file_name TEXT;
        RAISE NOTICE 'Added column: file_name';
    ELSE
        RAISE NOTICE 'Column already exists: file_name';
    END IF;

    -- Add file_size column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'course_materials' AND column_name = 'file_size'
    ) THEN
        ALTER TABLE course_materials ADD COLUMN file_size INTEGER;
        RAISE NOTICE 'Added column: file_size';
    ELSE
        RAISE NOTICE 'Column already exists: file_size';
    END IF;

    -- Add mime_type column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'course_materials' AND column_name = 'mime_type'
    ) THEN
        ALTER TABLE course_materials ADD COLUMN mime_type TEXT;
        RAISE NOTICE 'Added column: mime_type';
    ELSE
        RAISE NOTICE 'Column already exists: mime_type';
    END IF;
END $$;
