# 🎓 Beautex College Management System – Full Documentation

## 📄 Overview
The **Beautex College Management System** is a modern, full-stack application designed to streamline academic operations. It provides a robust platform for managing students, faculty, courses, attendance, grades, and administrative reports with role-based access control.

---

## 🏗️ Architecture & Tech Stack

### Frontend
- **Framework:** React 18 (Vite-powered)
- **Styling:** Tailwind CSS & Vanilla CSS
- **Icons:** Lucide React
- **Routing:** React Router DOM v6
- **Data Visualization:** Recharts (for dashboards)
- **API Client:** Axios

### Backend
- **Runtime:** Node.js (ES Modules)
- **Framework:** Express.js
- **Security:** Helmet, CORS, JWT-based Authentication
- **Email:** Nodemailer (Gmail SMTP / Ethereal fallback)
- **Validation:** Express Validator

### Database (Triple-Dialect Support)
The system features a custom database abstraction layer (`database.js`) supporting:
1. **PostgreSQL (Supabase):** Primary production-ready database.
2. **MongoDB Atlas:** Supported via Mongoose models.
3. **SQLite:** Local developer-friendly fallback.

---

## 🌟 Core Features

### 1. Authentication & Security
- **Multi-Role Access:** Superadmin, Admin, Teacher, and Student.
- **JWT Authentication:** Secure token-based sessions.
- **Password Management:** Reset password via email, mandatory password change flags, and manual admin resets.
- **Role-Based Portals:** Dedicated dashboards for each user type.

### 2. Academic Management
- **Student Registry:** Full lifecycle management including enrollment, profile tracking, and ID card generation.
- **Faculty Management:** Tracking instructors, departments, specializations, and course assignments.
- **Course Catalog:** Management of courses, capacity, schedules, and assigned rooms.
- **Session Scheduling:** Weekly timetable management with instructor assignments.

### 3. Performance & Attendance
- **Attendance Tracking:** Daily attendance marking per student and course.
- **Grading System:** Assignment scoring and cumulative grade tracking.
- **Academic Reports:** Detailed trainer reports including theory assessments, practical tasks, and discipline tracking.

### 4. Administrative Intelligence
- **Interactive Dashboards:** Real-time metrics for enrollments, attendance trends, and faculty distribution.
- **Activity Reports:** Detailed activity reporting for high-level management.
- **Announcements:** Global system-wide notices with priority levels (High/Medium/Low).
- **System Settings:** Centralized control for maintenance mode, portal toggles, and college branding.

---

## 🗄️ Database Schema Highlights

| Table | Description |
| :--- | :--- |
| `users` | Auth credentials, roles, and status. |
| `students` | Personal details, courses, and academic status. |
| `faculty` | Instructor profiles, departments, and position info. |
| `courses` | Subject details, capacity, and schedules. |
| `attendance` | Log of student presence/absence. |
| `grades` | Academic performance records. |
| `trainer_reports` | Deep-dive reports on student progress. |
| `system_settings` | Global configurations and metadata. |

---

## 🛠️ Project Structure
```bash
/college-management-system
├── /backend
│   ├── /src
│   │   ├── /config       # DB connections & initialization
│   │   ├── /controllers  # Business logic per module
│   │   ├── /middleware   # Auth & Validation
│   │   ├── /models       # SQL Schemas & Mongo Models
│   │   ├── /routes       # API Endpoints
│   │   └── /services     # External services (Email)
│   └── package.json
└── /frontend
    ├── /src
    │   ├── /components   # Reusable UI elements (IDCard, etc)
    │   ├── /pages        # Main views (Dashboard, Faculty, etc)
    │   ├── /services     # API abstraction (Axios)
    │   └── App.jsx       # Routing & Context
    └── vite.config.js
```

---

## 🚀 Setup & Execution

### Environment Configuration
Create a `.env` in `/backend`:
```env
PORT=5001
JWT_SECRET=your_secret
DATABASE_URL=your_supabase_url
SMTP_USER=gmail_address
SMTP_PASS=app_password
```

### Installation
```bash
# Backend
cd backend && npm install
npm run dev

# Frontend
cd frontend && npm install
npm run dev
```

---

## 📧 Email Notifications
The system sends automated "Welcome" emails to newly registered Students and Faculty, containing their generated credentials and a secure login link.
