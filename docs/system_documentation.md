# BTC-MS: System Documentation

## 1. Introduction
The Beautex Technical College Management System (BTC-MS) is a comprehensive ERP solution designed to automate and streamline the administrative, academic, and financial operations of the institution. Built with a modern tech stack (React, Node.js, Express, and SQLite/PostgreSQL), it provides a robust, role-based environment for Super Admins, Admins, Trainers, and Students.

---

## 2. System Architecture
BTC-MS follows a decoupled **Client-Server Architecture**:
- **Frontend**: A single-page application (SPA) built with **React.js**, utilizing **Tailwind CSS** for premium styling and **Heroicons/Lucide** for iconography.
- **Backend**: A RESTful API built with **Node.js** and **Express.js**.
- **Database**: Supports both **SQLite** (for development/small scale) and **PostgreSQL** (for production environments), managed via a custom database utility layer.
- **Authentication**: Stateless authentication using **JSON Web Tokens (JWT)**.
- **Security**: Password hashing via **bcryptjs**, CORS protection, and granular Role-Based Access Control (RBAC).

---

## 3. Portals & Access Control
The system is divided into four primary portals, each with specific permissions:

### 3.1 Super Admin Portal
The "Root" access level.
- **User Management**: Creation, deletion, and role reassignment of all campus personnel.
- **Finance Control**: Full authority to create fee structures, edit/delete payment records, and sync student ledgers.
- **Audit Logs**: View system-wide activity logs for security and accountability.
- **System Settings**: Manage institutional branding, academic periods, and database backups.

### 3.2 Admin Portal
Focuses on day-to-day operations.
- **Student & Faculty Management**: Registering new students and managing staff profiles.
- **Course Administration**: Designing and updating the course catalog.
- **Finance (Limited)**: Ability to view ledgers and record new payments. Editing/Deleting requires special Super Admin authorization.
- **Communication**: Posting campus-wide announcements.

### 3.3 Trainer/Teacher Portal
Focuses on academic delivery.
- **Grade & Attendance**: Real-time entry of student performance and attendance.
- **Reporting**: Submission of daily Trainer Reports and Student Progress Logs.
- **Course Materials**: Uploading digital resources for students to download.

### 3.4 Student Portal
Focuses on the learner experience.
- **Personal Dashboard**: Real-time view of attendance, grades, and upcoming schedules.
- **Financial Transparency**: View own student ledger, fee balance, and historical payment receipts.
- **Learning Hub**: Download course materials and review daily progress comments.

---

## 4. Core Modules

### 4.1 Academic Master Module
Centralized management of the college's academic structure:
- **Departments**: Organizing courses into academic units.
- **Periods (Semesters/Terms)**: Activating and closing academic windows.
- **Promotion Protocol**: Automated logic for promoting students between levels.

### 4.2 Financial Registry
A dual-entry ledger system for fee management:
- **Fee Structures**: Define required amounts per course.
- **Student Ledgers**: Track `Total Due`, `Total Paid`, and `Balance`.
- **Payment Lifecycle**: Support for diverse payment methods (M-Pesa, Cash, Bank) with receipt generation.

### 4.3 Student Information System (SIS)
- **Attendance Registry**: Visual calendar for tracking student presence.
- **Examination Protocol**: Tools for individual and batch grade entry.
- **Daily Progress Logs**: A feed of daily learning activities where students and trainers interact.

### 4.4 Reporting Engine
- **Trainer Performance**: Tracking daily topics covered and trainer remarks.
- **Institutional Activity**: Automatic capture of system stats (new registrations, payments collected).

---

## 5. Security & Maintenance
- **State Management**: Context API (AuthContext, ThemeContext) for global app state.
- **Data Integrity**: Middleware for server-side validation and audit logging of destructive actions (Deletes/Updates).
- **Responsive Design**: Designed for both desktop workstations and mobile tablet use.
---
**BTC-MS © 2026**
