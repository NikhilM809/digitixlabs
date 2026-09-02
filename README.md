# Digitix HRMS - Employee Leave & Attendance Management System

A modern, enterprise-grade Employee Leave & Attendance Management web application built for **DigitixLabs**.

![Digitix Labs](public/digitix-logo.png)

## Features

### Core Modules
- **Dashboard** — Role-based analytics with charts, stats, and activity feeds
- **Employee Management** — CRUD, bulk import/export, profile management, bank details, salary components, avatar upload
- **Leave Management** — Apply, approve/reject, balance tracking, bulk balance import/export, workflow notifications
- **Attendance** — Check-in/out, history, late marks, manual attendance entry, backdated corrections
- **Payslips** — Upload, generate, view, preview, and download monthly payslips
- **KRA** — Key Result Area evaluations with draft, submit, review, and reopen workflows
- **Work Schedules** — Admin-defined schedules; managers can manage direct-report schedules
- **Reports** — Export to Excel, CSV, and PDF
- **Notifications** — In-app notifications
- **Settings** — Company profile, attendance rules, org visibility, top-level employee, theme settings
- **Policies** — Company Policy Handbook (view all roles; manage sections as Admin)
- **Employee Documents** — Admin/HR document management; employees access **My Documents**
- **Custom Roles** — Admin-configurable employee roles and permissions (`/settings/roles`)

### Organization & Hierarchy
- **Organization Structure** (`/organization`) — Interactive org chart for employees, managers, and HR (when enabled)
- **Manage Hierarchy** (`/org-hierarchy`, Admin only) — Reporting tree, manager assignment, reporting history
- **Chart Layout Editor** — Drag-and-drop sibling reordering, direction/spacing controls; layout is visual only and does not change reporting lines
- **DigitixLabs company root** — Chart displays the company name at the top; branches below follow the configured top-level employee subtree
- **DR (Administrative Placeholder)** — Admin-only planning node, shown separately on the right at top level; not visible to employees/managers
- **My Team** — Managers/HR view direct and indirect reports

### User Roles
| Role | Capabilities |
|------|-------------|
| **Admin** | Full system access, org hierarchy, chart layout, policies, settings, reports |
| **HR** | Employee management, documents, leave, attendance, payslips, KRA |
| **Manager** | Team leave approvals, team attendance, direct-report work schedules, reports, My Team |
| **Employee** | Apply leave, view attendance, download payslips, KRA self-assessment, profile |

### UI/UX
- DigitixLabs branded design (colors, typography, logo)
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
# Apply database migrations (recommended)
npm run db:migrate:deploy

# Or push schema directly (development)
npm run db:push

# Seed sample data
npm run db:seed

# Seed company policy handbook (optional)
npm run db:seed-policies

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run db:migrate:deploy` | Apply Prisma migrations (production/Windows) |
| `npm run db:push` | Push schema without migrations |
| `npm run db:seed` | Seed sample users and data |
| `npm run db:seed-policies` | Seed Digitilix Labs policy handbook |
| `npm run db:import-employees` | Import employees from Excel sheet |
| `npm run db:studio` | Open Prisma Studio |

### Windows Setup

Run these steps in **PowerShell** from the project folder:

```powershell
# 1. Pull the latest code
git fetch origin
git pull origin cursor/org-structure-layout-fc8e

# 2. Run the one-time setup script (creates .env.local, clears cache)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\setup-windows.ps1

# 3. Set up PostgreSQL (pick ONE option below)
# 4. Apply migrations and seed
npm run db:migrate:deploy
npm run db:seed
npm run db:seed-policies

# 5. Start the app
npm run dev
```

#### Option A — PostgreSQL with Docker Desktop (easiest)

```powershell
docker compose up postgres -d
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

#### Option B — Local PostgreSQL on Windows

1. Install [PostgreSQL 16](https://www.postgresql.org/download/windows/) if not installed.
2. Make sure the **PostgreSQL** Windows service is running (Services app → `postgresql-x64-16`).
3. Create the database user and database (replace `16` with your version if different):

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -f scripts\setup-postgres-windows.sql
```

4. Then run:

```powershell
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

#### Option C — Use your existing PostgreSQL login

If you already have PostgreSQL with different credentials, edit `.env.local`:

```
DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/YOUR_DATABASE?schema=public"
```

Then run `npm run db:migrate:deploy` and `npm run db:seed`.

**Database login error on sign-in:**

If login shows `Authentication failed against the database server, the provided database credentials for hrms are not valid`, PostgreSQL is running but the `hrms` user does not exist or the password is wrong. Run Option A or B above, or update `DATABASE_URL` in `.env.local` to match your setup.

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

> Login is **case-insensitive** for email addresses.

### Password Reset

Forgot-password directs users to contact their **Manager or Admin**. Admins reset passwords via **Employees → Edit → Reset Password**.

## Production Deployment

```bash
git pull origin cursor/org-structure-layout-fc8e
npm ci
npx prisma migrate deploy
npm run db:seed-policies   # first-time policy handbook only
npm run build
pm2 restart hrms           # or your process manager
```

Ensure `.env` on the server has a valid `DATABASE_URL` and auth secrets before running seed scripts.

## Organization Chart Setup

1. **Settings → Company Profile** — Set company name (default: `DigitixLabs`). This label appears at the top of the org chart.
2. **Settings → Organization Hierarchy → Top-Level Employee** — Select the employee whose reporting subtree defines the organization (e.g. System Admin). Their direct reports (Param, Nikhil, Rohit, etc.) appear as branches under DigitixLabs.
3. **Manage Hierarchy → Chart Layout** (Admin) — Drag cards to reorder siblings, adjust direction/spacing, and save. Changes are visual only.
4. **Manage Hierarchy → Reporting Management** — Assign managers, assign employees to DR placeholder, view reporting history.

Chart layout is stored in `CompanySettings.orgChartLayoutJson`.

## Docker Deployment

```bash
# Build and run all services
docker compose up --build -d

# Run database migrations
docker compose exec app npx prisma migrate deploy

# Seed database
docker compose exec app npm run db:seed
docker compose exec app npm run db:seed-policies
```

## Environment Variables

See [.env.example](.env.example) for all required variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | NextAuth secret key |
| `AUTH_URL` / `NEXTAUTH_URL` | Application URL |
| `JWT_SECRET` | JWT signing secret |
| `UPLOADTHING_SECRET` | UploadThing API secret (optional) |
| `UPLOADTHING_APP_ID` | UploadThing app ID (optional) |
| `NEXT_PUBLIC_APP_NAME` | App display name |
| `NEXT_PUBLIC_APP_URL` | Public app URL |

## API Documentation

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/[...nextauth]` | Login/Logout |
| POST | `/api/auth/forgot-password` | Forgot password (directs to manager/admin) |
| POST | `/api/auth/reset-password` | Reset password with token |

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
| POST | `/api/employees/[id]/reset-password` | Admin reset employee password |
| POST | `/api/employees/bulk` | Bulk import employees |

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
| POST | `/api/attendance/manual` | Manual attendance entry |
| GET | `/api/attendance/check-in-preview` | Preview check-in status |

### Organization Hierarchy
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/org-hierarchy` | Admin reporting tree & employee detail |
| PATCH | `/api/org-hierarchy` | Assign/change manager |
| GET | `/api/org-hierarchy/chart` | Organization chart for all roles |
| GET/PATCH | `/api/org-hierarchy/layout` | Admin chart layout settings |
| GET | `/api/org-hierarchy/visibility` | Org chart visibility for current role |
| PATCH | `/api/org-hierarchy/administrative-position` | Assign DR placeholder |
| GET | `/api/org-hierarchy/team` | Team members for manager |

### Policies
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/policies` | List policy handbook sections |
| POST | `/api/policies` | Create section (Admin) |
| PATCH | `/api/policies/[id]` | Update section (Admin) |
| DELETE | `/api/policies/[id]` | Delete section (Admin) |

### Other Endpoints
- `/api/departments` — Department CRUD
- `/api/designations` — Designation CRUD
- `/api/employee-roles` — Custom role management
- `/api/employee-documents` — Employee document management
- `/api/employee-kra` — KRA configuration
- `/api/kra` — KRA evaluations
- `/api/work-schedules` — Work schedule management
- `/api/payslips` — Payslip management
- `/api/payslips/generate` — Generate payslips (Admin/HR)
- `/api/notifications` — Notifications
- `/api/profile` — User profile
- `/api/reports` — Generate reports
- `/api/settings` — Company settings
- `/api/announcements` — Company announcements

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Login, forgot/reset password
│   ├── (dashboard)/         # Protected dashboard pages
│   │   ├── organization/    # Org chart (all roles)
│   │   ├── org-hierarchy/   # Manage hierarchy + chart layout (Admin)
│   │   ├── policies/        # Company policy handbook
│   │   ├── kra/             # KRA evaluations
│   │   ├── work-schedules/  # Work schedule management
│   │   └── settings/        # Company & org settings
│   └── api/                 # API routes
│       └── org-hierarchy/   # Chart, layout, reporting APIs
├── components/
│   ├── ui/                  # ShadCN UI components
│   ├── layout/              # Sidebar, navbar, layout
│   ├── org/                 # Org chart & layout editor
│   ├── kra/                 # KRA panels
│   └── dashboard/           # Dashboard widgets
├── lib/
│   ├── auth.ts              # NextAuth configuration
│   ├── prisma.ts            # Prisma client
│   ├── org-hierarchy.ts     # Reporting tree logic
│   ├── org-chart-layout.ts  # Chart layout (client-safe)
│   ├── org-chart-layout-server.ts  # Layout persistence
│   ├── org-company-root.ts  # DigitixLabs company root node
│   ├── org-administrative-position.ts  # DR placeholder
│   ├── permissions.ts       # Role-based access helpers
│   └── validations/         # Zod schemas
prisma/
├── schema.prisma            # Database schema
├── seed.ts                  # Seed data
└── migrations/              # SQL migrations
scripts/
├── seed-company-policies.ts # Policy handbook seeder
├── test-org-hierarchy-logic.ts  # Org tree unit tests
└── import-employees-from-sheet.ts
```

## Database Schema

Key tables: Users, Departments, Designations, LeaveTypes, LeaveRequests, LeaveBalance, Attendance, Payslips, Notifications, AuditLogs, Announcements, CompanySettings, CompanyPolicy, OrgAdministrativePosition, ReportingHistory, EmployeeKra, KraReview, WorkSchedule, EmployeeDocument, Permissions, EmployeeRole

Notable `CompanySettings` fields:
- `companyName` — Displayed as org chart root (`DigitixLabs`)
- `topLevelEmployeeId` — Subtree anchor for organization view
- `orgChartLayoutJson` — Saved chart direction, spacing, sibling order
- `orgHierarchyVisibleToEmployees` / `orgHierarchyVisibleToManagers` — Visibility toggles

## Testing

```bash
# Org hierarchy logic (no database required)
npx tsx scripts/test-org-hierarchy-logic.ts
```

## Current Branch

Latest development branch: `cursor/org-structure-layout-fc8e`

Includes org chart layout editor, DigitixLabs company root, drag-and-drop sibling reordering, separate DR administrative placeholder, and company policy handbook management.

## License

Proprietary - DigitixLabs © 2026
