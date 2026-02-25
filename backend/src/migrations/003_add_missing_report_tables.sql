-- Migration: 003_add_missing_report_tables.sql
-- Purpose: Create academic_reports and trainer_reports tables if they don't exist.
-- These tables were added to supabase_schema.sql after the initial DB was provisioned.
-- Run this ONCE in the Supabase SQL Editor to fix "relation does not exist" errors
-- when creating or fetching reports in production.
-- Safe to run multiple times (CREATE TABLE IF NOT EXISTS).

-- ─── Academic Reports (Student Performance Reports) ───────────────────────────
CREATE TABLE IF NOT EXISTS academic_reports (
  id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  registration_number TEXT NOT NULL,
  course_unit TEXT NOT NULL,
  trainer_name TEXT NOT NULL,
  trainer_email TEXT NOT NULL,
  reporting_period TEXT NOT NULL,
  total_lessons INTEGER DEFAULT 0,
  attended_lessons INTEGER DEFAULT 0,
  attendance_percentage DECIMAL DEFAULT 0.0,
  theory_topics TEXT,
  theory_score DECIMAL,
  theory_remarks TEXT,
  practical_tasks TEXT,
  equipment_used TEXT,
  skill_level TEXT,
  safety_compliance TEXT,
  discipline_issues TEXT,
  trainer_observations TEXT,
  progress_summary TEXT,
  recommendation TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Trainer Daily Reports & Record of Work ────────────────────────────────────
CREATE TABLE IF NOT EXISTS trainer_reports (
  id SERIAL PRIMARY KEY,
  trainer_id TEXT NOT NULL,
  trainer_name TEXT NOT NULL,
  week_number TEXT NOT NULL,
  report_date DATE NOT NULL,
  daily_report TEXT NOT NULL,
  record_of_work TEXT NOT NULL,
  course_id TEXT,
  status TEXT DEFAULT 'Submitted',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
