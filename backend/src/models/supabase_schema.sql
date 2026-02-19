-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('superadmin', 'admin', 'teacher', 'student')),
  status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive')),
  photo TEXT,
  must_change_password BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Students table
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  course TEXT NOT NULL,
  semester TEXT,
  gpa DECIMAL DEFAULT 0.0,
  status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive', 'Graduated')),
  contact TEXT,
  photo TEXT,
  dob DATE,
  address TEXT,
  guardian_name TEXT,
  guardian_contact TEXT,
  blood_group TEXT,
  enrolled_date DATE DEFAULT CURRENT_DATE,
  completion_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  instructor TEXT NOT NULL,
  duration TEXT,
  enrolled INTEGER DEFAULT 0,
  capacity INTEGER NOT NULL,
  schedule TEXT,
  room TEXT,
  status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Faculty table
CREATE TABLE IF NOT EXISTS faculty (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  department TEXT NOT NULL,
  position TEXT,
  specialization TEXT,
  courses TEXT, -- JSON string of course names
  contact TEXT,
  passport TEXT,
  photo TEXT,
  status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course TEXT NOT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('Present', 'Absent', 'Late')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, course, date)
);

-- Grades table
CREATE TABLE IF NOT EXISTS grades (
  id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course TEXT NOT NULL,
  assignment TEXT NOT NULL,
  month TEXT,
  score DECIMAL NOT NULL,
  max_score DECIMAL NOT NULL,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('General', 'Academic', 'Facilities', 'Events')),
  priority TEXT NOT NULL CHECK(priority IN ('High', 'Medium', 'Low')),
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions (Schedule) table
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  day TEXT NOT NULL,
  time TEXT NOT NULL,
  course TEXT NOT NULL,
  room TEXT NOT NULL,
  instructor TEXT NOT NULL,
  teacher_email TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trainer Academic Reports table
CREATE TABLE IF NOT EXISTS trainer_reports (
  id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
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
  skill_level TEXT CHECK(skill_level IN ('Excellent', 'Good', 'Fair', 'Poor')),
  safety_compliance TEXT CHECK(safety_compliance IN ('Yes', 'No')),
  discipline_issues TEXT,
  trainer_observations TEXT,
  progress_summary TEXT,
  recommendation TEXT CHECK(recommendation IN ('Proceed', 'Improve', 'Review')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily Activity Reports
CREATE TABLE IF NOT EXISTS daily_activity_reports (
  id SERIAL PRIMARY KEY,
  report_date DATE NOT NULL UNIQUE,
  reported_by TEXT NOT NULL,
  classes_conducted INTEGER DEFAULT 0,
  total_attendance_percentage DECIMAL DEFAULT 0.0,
  assessments_conducted INTEGER DEFAULT 0,
  total_students_present INTEGER DEFAULT 0,
  total_students_absent INTEGER DEFAULT 0,
  late_arrivals INTEGER DEFAULT 0,
  new_enrollments INTEGER DEFAULT 0,
  staff_present INTEGER DEFAULT 0,
  staff_absent INTEGER DEFAULT 0,
  facilities_issues TEXT,
  equipment_maintenance TEXT,
  notable_events TEXT,
  incidents TEXT,
  achievements TEXT,
  additional_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Weekly Summary Reports
CREATE TABLE IF NOT EXISTS weekly_summary_reports (
  id SERIAL PRIMARY KEY,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  reported_by TEXT NOT NULL,
  total_classes_conducted INTEGER DEFAULT 0,
  average_attendance DECIMAL DEFAULT 0.0,
  total_assessments INTEGER DEFAULT 0,
  active_students INTEGER DEFAULT 0,
  avg_student_attendance DECIMAL DEFAULT 0.0,
  disciplinary_cases INTEGER DEFAULT 0,
  courses_completed INTEGER DEFAULT 0,
  new_enrollments INTEGER DEFAULT 0,
  key_achievements TEXT,
  challenges_faced TEXT,
  action_items TEXT,
  revenue_collected DECIMAL DEFAULT 0.0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(week_start_date, week_end_date)
);

-- Monthly Summary Reports
CREATE TABLE IF NOT EXISTS monthly_summary_reports (
  id SERIAL PRIMARY KEY,
  month TEXT NOT NULL,
  month_start_date DATE NOT NULL,
  month_end_date DATE NOT NULL,
  reported_by TEXT NOT NULL,
  total_students INTEGER DEFAULT 0,
  new_enrollments INTEGER DEFAULT 0,
  graduations INTEGER DEFAULT 0,
  dropouts INTEGER DEFAULT 0,
  total_classes INTEGER DEFAULT 0,
  average_attendance DECIMAL DEFAULT 0.0,
  total_assessments INTEGER DEFAULT 0,
  average_pass_rate DECIMAL DEFAULT 0.0,
  total_faculty INTEGER DEFAULT 0,
  new_hires INTEGER DEFAULT 0,
  faculty_departures INTEGER DEFAULT 0,
  revenue DECIMAL DEFAULT 0.0,
  expenses DECIMAL DEFAULT 0.0,
  major_achievements TEXT,
  challenges TEXT,
  strategic_initiatives TEXT,
  goals_next_month TEXT,
  additional_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(month_start_date, month_end_date)
);


-- End of schema
