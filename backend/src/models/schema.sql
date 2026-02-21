-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('superadmin', 'admin', 'teacher', 'student')),
  status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive', 'Suspended', 'Pending Approval')),
  photo TEXT,
  phone TEXT,
  address TEXT,
  bio TEXT,
  must_change_password BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Students table
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  course TEXT NOT NULL,
  intake TEXT,
  gpa REAL DEFAULT 0.0,
  status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive', 'Graduated')),
  contact TEXT,
  photo TEXT,
  dob DATE,
  address TEXT,
  guardian_name TEXT,
  guardian_contact TEXT,
  blood_group TEXT,
  enrolled_date DATE DEFAULT (date('now')),
  completion_date DATE,
  bio TEXT,
  phone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Faculty table
CREATE TABLE IF NOT EXISTS faculty (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  department TEXT NOT NULL,
  position TEXT,
  specialization TEXT,
  courses TEXT, -- JSON array of course names
  contact TEXT,
  photo TEXT,
  passport TEXT, -- Passport number for trainers
  address TEXT,
  bio TEXT,
  phone TEXT,
  status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL,
  course TEXT NOT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('Present', 'Absent', 'Late')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE(student_id, course, date)
);

-- Grades table
CREATE TABLE IF NOT EXISTS grades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL,
  course TEXT NOT NULL,
  assignment TEXT NOT NULL,
  month TEXT,
  score REAL NOT NULL,
  max_score REAL NOT NULL,
  remarks TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('General', 'Academic', 'Facilities', 'Events')),
  priority TEXT NOT NULL CHECK(priority IN ('High', 'Medium', 'Low')),
  date DATE DEFAULT (date('now')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sessions (Schedule) table
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  time TEXT NOT NULL,
  course TEXT NOT NULL,
  room TEXT NOT NULL,
  instructor TEXT NOT NULL,
  teacher_email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


-- Trainer Academic Reports table
CREATE TABLE IF NOT EXISTS trainer_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  registration_number TEXT NOT NULL,
  course_unit TEXT NOT NULL,
  trainer_name TEXT NOT NULL,
  trainer_email TEXT NOT NULL,
  reporting_period TEXT NOT NULL, -- e.g., "Week 1", "February"
  
  -- Attendance
  total_lessons INTEGER DEFAULT 0,
  attended_lessons INTEGER DEFAULT 0,
  attendance_percentage REAL DEFAULT 0.0,
  
  -- Theory Assessment
  theory_topics TEXT,
  theory_score REAL,
  theory_remarks TEXT,
  
  -- Practical Assessment
  practical_tasks TEXT,
  equipment_used TEXT,
  skill_level TEXT CHECK(skill_level IN ('Excellent', 'Good', 'Fair', 'Poor')),
  safety_compliance TEXT CHECK(safety_compliance IN ('Yes', 'No')),
  
  -- Discipline & Conduct
  discipline_issues TEXT,
  trainer_observations TEXT,
  
  -- Overall
  progress_summary TEXT,
  recommendation TEXT CHECK(recommendation IN ('Proceed', 'Improve', 'Review')),
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Daily Activity Reports
CREATE TABLE IF NOT EXISTS daily_activity_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_date DATE NOT NULL UNIQUE,
  reported_by TEXT NOT NULL,
  
  -- Academic Activities
  classes_conducted INTEGER DEFAULT 0,
  total_attendance_percentage REAL DEFAULT 0.0,
  assessments_conducted INTEGER DEFAULT 0,
  
  -- Student Activities
  total_students_present INTEGER DEFAULT 0,
  total_students_absent INTEGER DEFAULT 0,
  late_arrivals INTEGER DEFAULT 0,
  new_enrollments INTEGER DEFAULT 0,
  
  -- Staff & Faculty
  staff_present INTEGER DEFAULT 0,
  staff_absent INTEGER DEFAULT 0,
  
  -- Facilities & Resources
  facilities_issues TEXT,
  equipment_maintenance TEXT,
  
  -- Notable Events
  notable_events TEXT,
  incidents TEXT,
  achievements TEXT,
  
  -- General Notes
  additional_notes TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Weekly Summary Reports
CREATE TABLE IF NOT EXISTS weekly_summary_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  reported_by TEXT NOT NULL,
  
  -- Aggregated Statistics
  total_classes_conducted INTEGER DEFAULT 0,
  average_attendance REAL DEFAULT 0.0,
  total_assessments INTEGER DEFAULT 0,
  
  -- Student Metrics
  active_students INTEGER DEFAULT 0,
  avg_student_attendance REAL DEFAULT 0.0,
  disciplinary_cases INTEGER DEFAULT 0,
  
  -- Academic Progress
  courses_completed INTEGER DEFAULT 0,
  new_enrollments INTEGER DEFAULT 0,
  
  -- Highlights & Challenges
  key_achievements TEXT,
  challenges_faced TEXT,
  action_items TEXT,
  
  -- Financial (optional for future)
  revenue_collected REAL DEFAULT 0.0,
  
  notes TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(week_start_date, week_end_date)
);

-- Monthly Summary Reports
CREATE TABLE IF NOT EXISTS monthly_summary_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL,
  month_start_date DATE NOT NULL,
  month_end_date DATE NOT NULL,
  reported_by TEXT NOT NULL,
  
  -- Enrollment Statistics
  total_students INTEGER DEFAULT 0,
  new_enrollments INTEGER DEFAULT 0,
  graduations INTEGER DEFAULT 0,
  dropouts INTEGER DEFAULT 0,
  
  -- Academic Performance
  total_classes INTEGER DEFAULT 0,
  average_attendance REAL DEFAULT 0.0,
  total_assessments INTEGER DEFAULT 0,
  average_pass_rate REAL DEFAULT 0.0,
  
  -- Faculty & Staff
  total_faculty INTEGER DEFAULT 0,
  new_hires INTEGER DEFAULT 0,
  faculty_departures INTEGER DEFAULT 0,
  
  -- Financial Summary
  revenue REAL DEFAULT 0.0,
  expenses REAL DEFAULT 0.0,
  
  -- Strategic Overview
  major_achievements TEXT,
  challenges TEXT,
  strategic_initiatives TEXT,
  goals_next_month TEXT,
  
  additional_notes TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(month_start_date, month_end_date)
);

-- System Settings table
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT OR IGNORE INTO system_settings (key, value) VALUES 
('college_name', 'Beautex Technical College'),
('college_abbr', 'BTC'),
('academic_year', '2025/2026'),
('semester', 'Semester 1'),
('contact_email', 'admin@beautex.edu'),
('maintenance_mode', 'false'),
('student_portal_enabled', 'true'),
('teacher_portal_enabled', 'true'),
('parent_portal_enabled', 'true'),
('allow_registration', 'true'),
('grading_system', 'standard');

-- Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,
  resource TEXT,
  resource_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Departments table
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  head_of_department TEXT,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Fee Structures table
CREATE TABLE IF NOT EXISTS fee_structures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL, -- e.g., "Tuition", "Exam", "Registration"
  semester TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Student Fees table (Summary)
CREATE TABLE IF NOT EXISTS student_fees (
  student_id TEXT PRIMARY KEY,
  total_due REAL DEFAULT 0.0,
  total_paid REAL DEFAULT 0.0,
  balance REAL DEFAULT 0.0,
  last_payment_date DATETIME,
  status TEXT DEFAULT 'Pending' CHECK(status IN ('Paid', 'Partial', 'Pending', 'Overdue')),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT NOT NULL CHECK(method IN ('M-Pesa', 'Bank', 'Cash')),
  transaction_ref TEXT UNIQUE,
  payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  recorded_by TEXT, -- Admin email
  status TEXT DEFAULT 'Completed' CHECK(status IN ('Completed', 'Pending', 'Failed')),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Course Materials table
CREATE TABLE IF NOT EXISTS course_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  uploaded_by TEXT NOT NULL, -- Trainer email
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Academic Periods table
CREATE TABLE IF NOT EXISTS academic_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, -- e.g., "Term 1 2026"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT 0,
  status TEXT DEFAULT 'Upcoming' CHECK(status IN ('Upcoming', 'Ongoing', 'Completed')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


