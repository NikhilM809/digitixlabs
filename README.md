# Digitix HRMS - Employee Leave & Attendance Management System

A modern, enterprise-grade Employee Leave & Attendance Management web application built for **Digitix Labs**.

![Digitix Labs](public/digitix-logo.png)

## Features

### Core Modules
- **Dashboard** - Role-based analytics with charts, stats, and activity feeds
- **Employee Management** - CRUD operations, profile management, org hierarchy
- **Leave Management** - Apply, approve/reject, balance tracking, workflow notifications
- **Attendance** - Check-in/out, history, late marks, overtime tracking
- **Payslips** - Upload, view, preview, and download monthly payslips
- **Holiday Calendar** - Company and regional holidays
- **Reports** - Export to Excel, CSV, and PDF
- **Notifications** - Real-time in-app notifications
- **Settings** - Company policies, attendance rules, theme settings

### User Roles
| Role | Capabilities |
|------|-------------|
| **Admin** | Full system access, employee management, reports, settings |
| **Manager** | Team leave approvals, team attendance, reports |
| **Employee** | Apply leave, view attendance, download payslips, update profile |

### UI/UX
- Digitix Labs branded design (colors, typography, logo)
- Glassmorphism effects, gradient cards, soft shadows
- Dark/Light mode toggle
- Responsive mobile-friendly layout
- Framer Motion animations
- Loading skeletons, toast notifications, empty states

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4
- **UI Components:** ShadCN UI (Radix UI)
- **Animation:** Framer Motion
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** NextAuth.js v5 (JWT)
- **Forms:** React Hook Form + Zod
- **Data Fetching:** TanStack React Query
- **Tables:** TanStack Table
- **Charts:** Recharts
- **File Upload:** UploadThing
- **Export:** xlsx, jsPDF

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 16+
- npm

> **Note:** Docker is optional. If `docker` is not installed, use the local PostgreSQL setup below.

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd digitix-hrms

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
```

### Database Setup

**Option A — Local PostgreSQL (no Docker)**

```bash
# Ubuntu/Debian
sudo apt-get install -y postgresql postgresql-client
sudo pg_ctlcluster 16 main start

# Create database and user
sudo -u postgres psql -c "CREATE USER hrms WITH PASSWORD 'hrms_password';"
sudo -u postgres psql -c "CREATE DATABASE digitix_hrms OWNER hrms;"
sudo -u postgres psql -d digitix_hrms -c "GRANT ALL ON SCHEMA public TO hrms;"
```

**Option B — Docker (if available)**

```bash
docker compose up postgres -d
```

### Run the App

```bash
# Push database schema
npm run db:push

# Seed sample data
npm run db:seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Windows Setup

Run these steps in **PowerShell** from the project folder (e.g. `D:\work\Digitixlabs\digitixlabs`):

```powershell
# 1. Pull the latest code (includes auth fix)
git fetch origin
git checkout cursor/employee-leave-attendance-fc8e
git pull origin cursor/employee-leave-attendance-fc8e

# 2. Run the one-time setup script (creates .env.local, clears cache)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\setup-windows.ps1

# 3. Set up the database (PostgreSQL must be running)
npm run db:push
npm run db:seed

# 4. Start the app
npm run dev
```

**If you still see "server configuration issue":**

1. Stop the dev server (`Ctrl+C`).
2. Delete the cache folder: `Remove-Item -Recurse -Force .next`
3. Confirm `.env.local` exists in the project root (same folder as `package.json`).
4. Restart: `npm run dev`
5. Test in browser: [http://localhost:3000/api/auth/session](http://localhost:3000/api/auth/session) — it should return `null` with HTTP 200 (not 500).

**Manual `.env.local` (if the script fails):**

```powershell
Copy-Item env.example .env.local
notepad .env.local
```

Paste this content and save:

```
DATABASE_URL="postgresql://hrms:hrms_password@localhost:5432/digitix_hrms?schema=public"
AUTH_SECRET="digitix-hrms-local-dev-secret-2026"
AUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="digitix-hrms-local-dev-secret-2026"
NEXTAUTH_URL="http://localhost:3000"
JWT_SECRET="digitix-jwt-secret-key-change-in-production-2026"
NEXT_PUBLIC_APP_NAME="Digitix HRMS"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Admin Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@digitixlabs.com | Admin@123 |
| Manager | manager@digitixlabs.com | Welcome@123 |
| Employee | priya.sharma@digitixlabs.com | Welcome@123 |

## Docker Deployment

```bash
# Build and run all services
docker compose up --build -d

# Run database migrations
docker compose exec app npx prisma db push

# Seed database
docker compose exec app npm run db:seed
```

## Environment Variables

See [.env.example](.env.example) for all required variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_URL` | Application URL |
| `NEXTAUTH_SECRET` | NextAuth secret key |
| `JWT_SECRET` | JWT signing secret |
| `UPLOADTHING_SECRET` | UploadThing API secret (optional) |
| `UPLOADTHING_APP_ID` | UploadThing app ID (optional) |

## API Documentation

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/[...nextauth]` | Login/Logout |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Dashboard stats & charts |

### Employees
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/employees` | List employees |
| POST | `/api/employees` | Create employee (Admin) |
| GET | `/api/employees/[id]` | Get employee |
| PATCH | `/api/employees/[id]` | Update employee |
| DELETE | `/api/employees/[id]` | Deactivate employee |

### Leave
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leave` | List leave requests |
| POST | `/api/leave` | Apply for leave |
| PATCH | `/api/leave/[id]` | Approve/Reject/Cancel |
| GET | `/api/leave/balance` | Get leave balances |

### Attendance
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/attendance` | List attendance records |
| POST | `/api/attendance` | Check-in/Check-out |

### Other Endpoints
- `/api/departments` - Department CRUD
- `/api/designations` - Designation CRUD
- `/api/holidays` - Holiday calendar CRUD
- `/api/leave-types` - Leave type management
- `/api/payslips` - Payslip management
- `/api/notifications` - Notifications
- `/api/profile` - User profile
- `/api/reports` - Generate reports
- `/api/settings` - Company settings
- `/api/announcements` - Company announcements

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login, forgot/reset password
│   ├── (dashboard)/     # Protected dashboard pages
│   └── api/             # API routes
├── components/
│   ├── ui/              # ShadCN UI components
│   ├── layout/          # Sidebar, navbar, layout
│   └── dashboard/       # Dashboard widgets
├── lib/
│   ├── auth.ts          # NextAuth configuration
│   ├── prisma.ts        # Prisma client
│   ├── validations/     # Zod schemas
│   └── utils.ts         # Utility functions
prisma/
├── schema.prisma        # Database schema
└── seed.ts              # Seed data
```

## Database Schema

Key tables: Users, Departments, Designations, LeaveTypes, LeaveRequests, LeaveBalance, Attendance, Payslips, Notifications, HolidayCalendar, AuditLogs, Announcements, CompanySettings, Permissions

## License

Proprietary - Digitix Labs © 2026
