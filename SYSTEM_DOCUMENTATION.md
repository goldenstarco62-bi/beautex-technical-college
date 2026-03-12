# 🎓 Beautex Technical Training College — Management System
### Full System Documentation · Version 2.0 · March 2026

---

## 📋 Table of Contents
1. [System Overview](#1-system-overview)
2. [Architecture & Tech Stack](#2-architecture--tech-stack)
3. [System Architecture Diagram](#3-system-architecture-diagram)
4. [User Roles & Permissions](#4-user-roles--permissions)
5. [Core Modules](#5-core-modules)
6. [Inventory Vault Module](#6-inventory-vault-module)
7. [Database Schema](#7-database-schema)
8. [API Reference](#8-api-reference)
9. [Project File Structure](#9-project-file-structure)
10. [Frontend Component Map](#10-frontend-component-map)
11. [Authentication Flow](#11-authentication-flow)
12. [Setup & Installation](#12-setup--installation)
13. [Environment Variables](#13-environment-variables)
14. [Known Issues & Fixes Applied](#14-known-issues--fixes-applied)

---

## 1. System Overview

The **Beautex College Management System** is a full-stack web application designed to centralize all administrative, academic, and logistical operations of Beautex Technical Training College. Built as a Progressive Web App (PWA), it supports multiple user portals, real-time dashboards, a full inventory management system, and automated email notifications.

### Key Highlights
- 🔐 **Role-Based Access Control** — 4 user tiers (Superadmin → Student)
- 📦 **Inventory Vault** — Full logistics requisition lifecycle management
- 📊 **Live Dashboards** — Real-time stats for all roles
- 📱 **Mobile-Responsive** — Smart bottom navigation with auto-hide
- 🗄️ **Triple-DB Support** — PostgreSQL (primary), MongoDB, SQLite (dev fallback)
- 📧 **Automated Emails** — Welcome messages with credentials on account creation
- 🌐 **Deployed** — Frontend on Vercel, Backend on Railway/Render

---

## 2. Architecture & Tech Stack

### Frontend
| Technology | Purpose |
|:---|:---|
| **React 18 (Vite)** | UI framework with fast HMR |
| **React Router DOM v6** | Client-side routing |
| **Tailwind CSS** | Utility-first styling |
| **Lucide React** | Premium icon set |
| **Axios** | HTTP API client with interceptors |
| **React Context API** | Global auth & user state |

### Backend
| Technology | Purpose |
|:---|:---|
| **Node.js (ESM)** | Runtime using ES Modules |
| **Express.js** | REST API framework |
| **JSON Web Tokens** | Stateless authentication |
| **Bcrypt.js** | Password hashing |
| **Multer** | File/image uploads |
| **Nodemailer** | Email automation (Gmail SMTP) |
| **Helmet + CORS** | Security hardening |
| **Express Validator** | Request data validation |

### Database
| Database | Role |
|:---|:---|
| **PostgreSQL (Supabase)** | Primary production store — all users, students, inventory |
| **MongoDB (Atlas)** | Secondary store — trainer reports, material metadata |
| **SQLite** | Local dev fallback when no cloud DB is available |

> **Database Abstraction Layer** (`backend/src/config/database.js`) automatically detects the available database and routes all queries accordingly. It also translates SQLite-dialect SQL (e.g. `date('now')`) to PostgreSQL equivalents (`CURRENT_DATE`).

---

## 3. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      BROWSER / CLIENT                        │
│                                                             │
│  ┌──────────────┐   ┌────────────────┐   ┌──────────────┐  │
│  │  React SPA   │   │  Axios Client  │   │  Auth Context│  │
│  │  (Vite PWA)  │◄──┤  /services/   ├──►│  JWT Token  │  │
│  └──────┬───────┘   │  api.js        │   └──────────────┘  │
│         │           └────────┬───────┘                      │
└─────────┼────────────────────┼────────────────────────────--┘
          │ HTTP/HTTPS          │ Bearer Token
          ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                     EXPRESS.JS API SERVER                    │
│                    (Node.js, port 5000)                      │
│                                                             │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │ Middleware │  │   Routers    │  │    Controllers       │ │
│  │ • JWT Auth │  │ /api/auth    │  │ • authController     │ │
│  │ • CORS     │  │ /api/users   │  │ • studentController  │ │
│  │ • Helmet   │  │ /api/students│  │ • inventoryController│ │
│  │ • Multer   │  │ /api/inventory│  │ • financeController  │ │
│  │ • Validator│  │ /api/finance │  │ • reportController   │ │
│  └────────────┘  └──────────────┘  └──────────────────────┘ │
└──────────────────────────────┬──────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                      ▼
┌────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  PostgreSQL DB │   │   MongoDB Atlas  │   │  SQLite (dev)   │
│  (Supabase)    │   │                  │   │                 │
│                │   │  • trainer_rpts  │   │  Fallback only  │
│  • users       │   │  • materials     │   │  No cloud req.  │
│  • students    │   │  • interactions  │   │                 │
│  • inventory   │   │                  │   │                 │
│  • finance     │   │                  │   │                 │
│  • attendance  │   │                  │   │                 │
└────────────────┘   └─────────────────┘   └─────────────────┘
```

---

## 4. User Roles & Permissions

```
┌─────────────────────────────────────────────────────────────┐
│                    ROLE HIERARCHY                            │
│                                                             │
│   SUPERADMIN ──► Full access: all settings, all data        │
│       │                                                     │
│       ▼                                                     │
│   ADMIN ──────► All modules except system configuration     │
│       │                                                     │
│       ▼                                                     │
│   TEACHER ────► Own classes, requisitions, reports only     │
│       │                                                     │
│       ▼                                                     │
│   STUDENT ────► Own profile, grades, attendance only        │
└─────────────────────────────────────────────────────────────┘
```

| Feature | Superadmin | Admin | Teacher | Student |
|:---|:---:|:---:|:---:|:---:|
| User Management | ✅ | ✅ | ❌ | ❌ |
| Student Registry | ✅ | ✅ | 👁 View | 👁 Own |
| Inventory Dashboard | ✅ | ✅ | ✅ (own stats) | ❌ |
| Inventory Items | ✅ | ✅ | 👁 View | ❌ |
| Create Requisitions | ✅ | ✅ | ✅ | ❌ |
| Approve/Reject Requisitions | ✅ | ✅ | ❌ | ❌ |
| Delete Requisitions | ✅ | ✅ | ❌ | ❌ |
| Finance Module | ✅ | ✅ | ❌ | 👁 Own fees |
| System Settings | ✅ | ❌ | ❌ | ❌ |
| Academic Reports | ✅ | ✅ | ✅ | 👁 Own |

---

## 5. Core Modules

### 5.1 Authentication
- **Login**: Email + password, returns signed JWT (24h expiry)
- **Token Storage**: `localStorage` via Axios interceptor
- **Auto-Logout**: Token expiry detection with redirect to `/login`
- **Password Reset**: Secure email link with one-time token

### 5.2 User Management
- Create, update, delete users (all roles)
- Profile picture upload via Multer → stored as base64 or file path
- Admin can reset any user's password and force re-login

### 5.3 Student Registry
- Full enrollment lifecycle (Active → Suspended → Completed)
- Bulk import support
- ID Card generation (printable PDF-like view)
- Parent contact, emergency details, course assignment

### 5.4 Academic Management
- **Courses**: Title, code, capacity, department, assigned instructor
- **Timetables**: Weekly session scheduling per course
- **Departments**: Grouping structure for faculty and courses
- **Academic Periods**: Term/semester tracking with activation

### 5.5 Attendance & Grades
- Daily attendance marking per session
- Grade entry per assessment
- Cumulative grade calculation and grade history

### 5.6 Finance
- Fee structures per course/department
- Student fee balances and payment recording
- Payment history with receipt generation

### 5.7 Activity Reports
- Daily, Weekly, Monthly reports by trainers
- Auto-capture of attendance data into reports
- Summary views for management

### 5.8 Announcements
- System-wide notices with priority (High/Medium/Low)
- Target by role or all users

---

## 6. Inventory Vault Module

The **Inventory Vault** is the most recent major feature addition. It provides complete logistical asset management.

### 6.1 Module Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    INVENTORY VAULT                              │
│                                                                │
│  ┌────────────┐  ┌───────────────┐  ┌──────────────────────┐  │
│  │ Dashboard  │  │   Inventory   │  │    Requisitions      │  │
│  │            │  │   Items Tab   │  │    Tab               │  │
│  │ Admin/SA:  │  │               │  │                      │  │
│  │ • Total    │  │ • Search      │  │ Admin/SA:            │  │
│  │   Items    │  │ • Filter by   │  │ • View all requests  │  │
│  │ • Capital  │  │   Category    │  │ • Approve / Reject   │  │
│  │   Value    │  │ • Sort        │  │ • Issue Stock        │  │
│  │ • Low Stock│  │ • Add Item    │  │ • Delete Request     │  │
│  │ • Issued   │  │ • Edit Item   │  │                      │  │
│  │   Today    │  │ • Delete Item │  │ Teacher:             │  │
│  │            │  │ • Export CSV  │  │ • View own requests  │  │
│  │ Teacher:   │  │               │  │ • Create new request │  │
│  │ • Pending  │  │               │  │                      │  │
│  │ • Approved │  └───────────────┘  └──────────────────────┘  │
│  │ • Received │                                                │
│  │   Today    │  ┌───────────────┐  ┌──────────────────────┐  │
│  └────────────┘  │  Stock Logs   │  │   My Supplies        │  │
│                  │  (Admin only) │  │   (Admin/SA only)    │  │
│                  │ • Stock In    │  │ • Personal assigned  │  │
│                  │ • Stock Out   │  │   items tracking     │  │
│                  └───────────────┘  └──────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### 6.2 Requisition Lifecycle

```
Teacher Creates Request
        │
        ▼
   [PENDING] ──────────────────────────────────────────────┐
        │                                                   │
        │  Admin/Superadmin Reviews                         │
        ├──────────────────┐                                │
        ▼                  ▼                                ▼
  [APPROVED]         [REJECTED]                      Admin Deletes
        │                  │                               (Trash icon)
        │  Admin Issues     │
        ▼                  │
   [ISSUED] ◄─────────────┘
        │
        ▼
  Stock deducted from Inventory
  Stock Out Log created automatically
```

### 6.3 Inventory Database Tables

| Table | Description |
|:---|:---|
| `inv_categories` | Item categories (e.g. Chemicals, Equipment) |
| `inv_locations` | Physical storage locations within the college |
| `inv_items` | Master asset register with quantity & pricing |
| `inv_suppliers` | Vendor and supplier information |
| `inv_stock_in` | Incoming stock delivery records |
| `inv_stock_out` | Outbound issue records (with recipient) |
| `inv_department_requests` | Teacher requisition pipeline |
| `inv_purchase_requests` | Procurement purchase orders |
| `inv_assets` | Fixed asset register |
| `inv_damage_logs` | Damaged/lost item reports |

### 6.4 Dashboard Stats (Admin/Superadmin)
- **Total Inventory** — number of unique items in store
- **Capital Valuation** — total value of all stock (KSh)
- **Critical Shortage** — items below minimum stock level
- **Issued Today** — count of stock out transactions today
- **Volume Heatmap** — monthly stock movement chart
- **Expiring Soon** — items with expiry within 30 days

### 6.5 Dashboard Stats (Teacher)
- **Pending** — their own pending requisitions
- **Approved** — their own approved requisitions
- **Received Today** — items issued to them today
- **Total Issued** — all items ever issued to them

---

## 7. Database Schema

### Core Tables (PostgreSQL)

```sql
-- Users (all roles)
users (id, name, email, password_hash, role, status, 
       profile_picture, force_password_change, created_at)

-- Students
students (id, user_id, student_number, course_id, department,
          enrollment_status, parent_name, parent_phone, created_at)

-- Courses
courses (id, code, title, department_id, capacity, 
         instructor_id, schedule, room, created_at)

-- Attendance
attendance (id, student_id, course_id, date, status, 
            marked_by, notes)

-- Grades
grades (id, student_id, course_id, assessment_type,
        score, max_score, graded_by, graded_at)

-- Inventory Items
inv_items (id, name, category_id, location_id, quantity,
           unit_type, minimum_stock_level, purchase_price,
           status, expiry_date, serial_number, created_at)

-- Department Requests
inv_department_requests (id, request_id, department, 
                         requested_by, requested_by_name,
                         item_id, item_name, quantity, 
                         status, purpose, approved_by,
                         approved_date, issued_date, notes)
```

---

## 8. API Reference

### Authentication
| Method | Endpoint | Role | Description |
|:---|:---|:---|:---|
| POST | `/api/auth/login` | Public | Login and receive JWT |
| POST | `/api/auth/logout` | All | Invalidate session |
| POST | `/api/auth/reset-password` | All | Initiate password reset |

### Inventory
| Method | Endpoint | Role | Description |
|:---|:---|:---|:---|
| GET | `/api/inventory/dashboard` | Admin, SA, Teacher | Dashboard statistics |
| GET | `/api/inventory/items` | All | List all inventory items |
| POST | `/api/inventory/items` | Admin, SA | Create new item |
| PUT | `/api/inventory/items/:id` | Admin, SA | Update item |
| DELETE | `/api/inventory/items/:id` | Admin, SA | Delete item |
| GET | `/api/inventory/requests` | All | List requisitions |
| POST | `/api/inventory/requests` | All | Create requisition |
| PUT | `/api/inventory/requests/:id` | Admin, SA | Update status |
| DELETE | `/api/inventory/requests/:id` | Admin, SA | Delete requisition |
| GET | `/api/inventory/stock-in` | Admin, SA | Stock in logs |
| POST | `/api/inventory/stock-in` | Admin, SA | Add stock in |
| GET | `/api/inventory/stock-out` | Admin, SA | Stock out logs |
| POST | `/api/inventory/stock-out` | Admin, SA | Issue stock |

---

## 9. Project File Structure

```
college-management-system/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js          ← Triple-DB abstraction layer
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── inventoryController.js ← Full CRUD for all inventory
│   │   │   ├── financeController.js
│   │   │   ├── studentController.js
│   │   │   └── ...
│   │   ├── middleware/
│   │   │   ├── auth.js              ← JWT verification
│   │   │   └── validation.js        ← Request validators
│   │   ├── models/
│   │   │   ├── postgres_inventory_schema.sql
│   │   │   └── mongoModels.js
│   │   ├── routes/
│   │   │   └── api.js               ← All route definitions
│   │   ├── services/
│   │   │   └── emailService.js      ← Nodemailer email sender
│   │   └── server.js                ← Express entry point
│   ├── .env                         ← Environment secrets
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── layout/
    │   │   │   ├── Layout.jsx        ← Wraps all pages
    │   │   │   ├── Sidebar.jsx       ← Desktop navigation
    │   │   │   ├── Navbar.jsx        ← Top bar
    │   │   │   └── MobileBottomNav.jsx ← Mobile nav (auto-hide)
    │   │   └── ui/                   ← Shared UI components
    │   ├── context/
    │   │   └── AuthContext.jsx       ← Global auth state
    │   ├── pages/
    │   │   ├── Dashboard.jsx
    │   │   ├── Inventory.jsx         ← Full inventory vault UI
    │   │   ├── Students.jsx
    │   │   ├── Faculty.jsx
    │   │   ├── Finance.jsx
    │   │   ├── Reports.jsx
    │   │   └── Settings.jsx
    │   ├── services/
    │   │   └── api.js                ← All Axios API calls
    │   └── App.jsx                   ← Routes & providers
    ├── .env
    └── vite.config.js
```

---

## 10. Frontend Component Map

```
App.jsx
└── AuthProvider (Context)
    └── Router
        ├── /login ──────────────── LoginPage.jsx
        └── Layout.jsx (protected)
            ├── Sidebar.jsx
            ├── Navbar.jsx
            ├── MobileBottomNav.jsx  ← Auto-hides on scroll down
            └── <Page>
                ├── /dashboard ───── Dashboard.jsx
                ├── /inventory ───── Inventory.jsx
                │   ├── DashboardTab (stats + chart + panels)
                │   ├── ItemsTab (search, filter, CRUD)
                │   ├── RequestsTab (lifecycle management)
                │   ├── StockMovementTab (in/out logs)
                │   └── MyStockTab (personal supplies)
                ├── /students ────── Students.jsx
                ├── /faculty ─────── Faculty.jsx
                ├── /finance ─────── Finance.jsx
                ├── /reports ─────── Reports.jsx
                └── /settings ────── Settings.jsx
```

---

## 11. Authentication Flow

```
User enters email + password
        │
        ▼
POST /api/auth/login
        │
        ├── Invalid credentials ──► 401 Unauthorized
        │
        └── Valid ──────────────► JWT Signed (24h)
                                        │
                                        ▼
                              Stored in localStorage
                                        │
                                        ▼
                         Axios Interceptor attaches to all requests
                         Authorization: Bearer <token>
                                        │
                                        ▼
                         JWT Middleware validates on every request
                                        │
                                        ├── Expired ──► 401 → Auto logout
                                        └── Valid ───► req.user populated
                                                              │
                                                              ▼
                                                  authorizeRoles() checks role
                                                        │
                                                        ├── Unauthorized ──► 403
                                                        └── Authorized ───► Controller
```

---

## 12. Setup & Installation

### Prerequisites
- Node.js v18+
- npm v9+
- PostgreSQL (or Supabase URL)
- MongoDB Atlas URI (optional — for reports)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-repo/college-management-system.git
cd college-management-system

# 2. Backend setup
cd backend
npm install
cp .env.example .env    # Fill in your credentials
npm run dev             # Starts on http://localhost:5000

# 3. Frontend setup (new terminal)
cd ../frontend
npm install
npm run dev             # Starts on http://localhost:5173
```

---

## 13. Environment Variables

### Backend `.env`
```env
PORT=5000
JWT_SECRET=your_super_secret_key_here

# PostgreSQL (Supabase)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# MongoDB (Optional - for reports)
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/dbname

# Email (Gmail SMTP)
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Optional
NODE_ENV=development
```

### Frontend `.env`
```env
VITE_API_URL=http://localhost:5000/api
```

---

## 14. Known Issues & Fixes Applied

| Issue | Root Cause | Fix Applied |
|:---|:---|:---|
| Inventory Dashboard "Logistics Data Sync Error" | PostgreSQL date functions incompatible with SQLite-dialect SQL | Updated `translateSqlForPostgres()` to handle `±N days` intervals |
| Capital Valuation crash | `toLocaleString()` called on string `"0"` not number | Wrapped with `Number(stats.totalValue \|\| 0).toLocaleString()` |
| Teacher blocked from dashboard | `authorizeRoles` on `/inventory/dashboard` excluded `teacher` role | Added `teacher` to allowed roles |
| Mobile bottom nav blocks buttons | Fixed-position nav overlapped action buttons | Added scroll-aware auto-hide: slides out on scroll-down, returns on scroll-up |
| Requisition cards too large | Excessive padding `p-6`, `rounded-3xl`, tall buttons `h-14` | Compressed to `px-4 py-3`, `rounded-2xl`, slim buttons `h-8` |
| Dashboard stat cards too large | Vertical layout with `w-12 h-12` icons and `text-3xl` values | Switched to horizontal inline layout, `w-9 h-9`, `text-xl` |
| Delete button missing on Requisitions | No frontend delete button; backend `deleteDepartmentRequest` existed but was unused | Added trash icon button with confirmation dialog (admins only) |

---

## 📅 Changelog

### Version 2.0 — March 2026
- ✅ Full Inventory Vault module (items, categories, locations, suppliers)
- ✅ Department Requisition pipeline with full lifecycle (Pending → Approved → Issued)
- ✅ Delete button on requisition list (admin/superadmin only)
- ✅ Dashboard compact redesign — all sections reduced in height
- ✅ Mobile bottom nav auto-hide on scroll
- ✅ Role-aware dashboard stats (different views for admin vs teacher)
- ✅ Capital Valuation bugfix (numeric type coercion)
- ✅ PostgreSQL SQL dialect translation improvements

### Version 1.0 — Initial Release
- ✅ Multi-role authentication (Superadmin, Admin, Teacher, Student)
- ✅ Student Registry with full CRUD
- ✅ Faculty management
- ✅ Course catalog and timetable
- ✅ Attendance tracking
- ✅ Grading system
- ✅ Finance module (fees, payments)
- ✅ Activity reports (Daily, Weekly, Monthly)
- ✅ Announcements system
- ✅ System settings

---

*Documentation maintained by: ICT Department, Beautex Technical Training College*
*Last updated: 12 March 2026*
