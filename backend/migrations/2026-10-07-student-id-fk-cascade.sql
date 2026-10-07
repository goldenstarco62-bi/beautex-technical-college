-- 2026-10-07: Allow renaming a student's admission number (students.id) without
-- breaking referential integrity. The original FKs used ON UPDATE NO ACTION,
-- which made any rename fail with 23503 as soon as child rows referenced the
-- old ID. Recreated with ON UPDATE CASCADE (ON DELETE CASCADE preserved).
-- Applied to the Supabase (Postgres) production database on 2026-10-07 inside a
-- single transaction. Tables without FKs (cat_results, academic_reports,
-- result_audit_logs, unit_coverage_confirmations, unit_coverage_logs) are
-- cascaded in application code (studentController.updateStudent).

BEGIN;

ALTER TABLE payments DROP CONSTRAINT payments_student_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE attendance DROP CONSTRAINT attendance_student_id_fkey;
ALTER TABLE attendance ADD CONSTRAINT attendance_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE grades DROP CONSTRAINT grades_student_id_fkey;
ALTER TABLE grades ADD CONSTRAINT grades_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE student_fees DROP CONSTRAINT student_fees_student_id_fkey;
ALTER TABLE student_fees ADD CONSTRAINT student_fees_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE student_unit_marks DROP CONSTRAINT student_unit_marks_student_id_fkey;
ALTER TABLE student_unit_marks ADD CONSTRAINT student_unit_marks_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE student_daily_reports DROP CONSTRAINT student_daily_reports_student_id_fkey;
ALTER TABLE student_daily_reports ADD CONSTRAINT student_daily_reports_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE monthly_fee_tracking DROP CONSTRAINT monthly_fee_tracking_student_id_fkey;
ALTER TABLE monthly_fee_tracking ADD CONSTRAINT monthly_fee_tracking_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE monthly_fee_notifications DROP CONSTRAINT monthly_fee_notifications_student_id_fkey;
ALTER TABLE monthly_fee_notifications ADD CONSTRAINT monthly_fee_notifications_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE;

COMMIT;
