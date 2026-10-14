# MedSync

## Clinic Appointment and Treatment Management System

MedSync is a database-focused clinic management system for coordinating patients, guardians, doctors, appointments, treatments, billing, payments, insurance claims, reporting, and audit history across multiple clinic branches.

The application supports role-based workflows for:

- Administrators
- Branch Managers
- Receptionists
- Doctors
- QA Testers

## Technology Stack

| Layer | Technologies |
|---|---|
| Backend | Python 3.14+, FastAPI, Uvicorn, asyncpg, Pydantic |
| Authentication | JWT access tokens and rotating refresh tokens |
| Database | PostgreSQL 17 through Supabase local development |
| Frontend | React 19, TypeScript, Vite, React Router |
| UI and charts | Tailwind CSS, Recharts |
| Development | Docker Compose, Supabase CLI, `uv`, npm |
| Production frontend | Vite build served by nginx |

## Features

- Multi-branch clinic management
- Staff, doctor, specialty, and account management
- Patient, guardian, phone, and insurance records
- Scheduled and walk-in appointments
- Doctor availability and appointment overlap protection
- Consultation notes and treatment logging
- Automatic invoice creation when appointments are completed
- Insurance claims, discounts, partial payments, and outstanding balances
- Treatment amendments instead of destructive treatment deletion
- Role-based access control and branch ownership rules
- Database-triggered audit logging
- Operational and financial reports
- PDF report generation
- Refresh-token rotation and session invalidation

## Architecture

The local development stack has three parts:

1. **FastAPI backend**: runs in the `backend` container on port `8000`.
2. **React frontend**: runs in the `frontend` container on port `5173` and proxies `/api` requests to the backend.
3. **Supabase local services**: run through the Supabase CLI and Docker, with PostgreSQL on port `54322` and Studio on port `54323`.

The application containers are defined in [docker-compose.dev.yml](docker-compose.dev.yml). Supabase is intentionally started separately with `npx supabase start`; it is not a `db` service in the application Compose file.

## Repository Layout

```text
MedSync/
├── backend/
│   ├── app/
│   │   ├── core/                 # configuration, database, security, dependencies
│   │   ├── domains/              # business domains and API routers
│   │   └── main.py               # FastAPI application entry point
│   ├── scripts/                  # integration and authorization checks
│   ├── tests/                    # backend tests
│   ├── Dockerfile                # production image
│   ├── Dockerfile.dev            # development image
│   └── pyproject.toml
├── frontend/
│   ├── src/                      # React application
│   ├── public/                   # static assets
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   ├── nginx.conf
│   └── package.json
├── supabase/
│   ├── migrations/               # schema, views, triggers, indexes, and seed data
│   └── config.toml
├── docker-compose.dev.yml
├── Makefile
├── package.json                  # Supabase CLI dependency
└── Readme.MD
```

## Prerequisites

Install the following tools before starting:

| Tool | Recommended version | Purpose |
|---|---|---|
| Docker Desktop | Current | Runs application and Supabase containers |
| Python | 3.14 or newer | Backend development outside Docker |
| `uv` | Current | Backend dependency and command management |
| Node.js and npm | Current LTS | Frontend and Supabase CLI dependencies |
| Supabase CLI | Current | Local PostgreSQL and migrations |
| GNU Make | Current | Runs the project setup, development, migration, test, and lint targets |
| Git | Current | Source control |
| `curl` and `jq` | Current | API and shell integration tests |

On Windows, install GNU Make and run the Makefile targets from Git Bash, WSL, or another POSIX-compatible shell. The Makefile uses commands such as `cp`, `cd`, and `||`, which are not available in a standard PowerShell command shell. Docker Desktop with WSL integration enabled is recommended for WSL users. Linux users can use a normal terminal.

Install GNU Make using the package manager appropriate for your system. For example:

```bash
# Debian or Ubuntu
sudo apt update
sudo apt install make

# Fedora
sudo dnf install make
```

On Windows, GNU Make can be installed through Chocolatey, Scoop, MSYS2, or WSL. Verify the installation with:

```bash
make --version
```

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/CATMAS-DB-project/MedSync.git
cd MedSync
```

### 2. Create the environment file

PowerShell:

```powershell
Copy-Item .env.example .env
```

Linux, macOS, Git Bash, or WSL:

```bash
cp .env.example .env
```

At minimum, review these values in `.env`:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:54322/postgres
ENVIRONMENT=development
LOG_LEVEL=DEBUG
JWT_SECRET=replace-with-a-random-secret-at-least-32-characters-long
JWT_ALGORITHM=HS256
JWT_ISSUER=catms
JWT_AUDIENCE=catms-api
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=14
REFRESH_COOKIE_NAME=catms_refresh_token
REFRESH_COOKIE_SECURE=false
REFRESH_COOKIE_SAMESITE=lax
REFRESH_COOKIE_PATH=/api/v1/auth
```

`host.docker.internal` is correct when the backend runs inside Docker. If you run the backend directly on the host, use `127.0.0.1` instead:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

Do not commit real database passwords, service-role keys, or production JWT secrets.

### 3. Install dependencies

The Makefile is the recommended way to install the project dependencies:

```bash
make setup
make setup-frontend
```

Equivalent commands:

```bash
npm install
cd backend
uv sync
cd ../frontend
npm ci
cd ..
```

On Windows, run these Makefile commands from Git Bash or WSL after installing GNU Make. If you create `.env` manually in PowerShell, use `Copy-Item .env.example .env` before switching to Git Bash or WSL.

### 4. Start Supabase

```bash
npx supabase start
npx supabase status
```

Important local URLs:

| Service | URL |
|---|---|
| Supabase API | `http://127.0.0.1:54321` |
| PostgreSQL | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Supabase Studio | `http://127.0.0.1:54323` |

The first startup downloads several Docker images and may take a few minutes.

### 5. Apply the database migrations

```bash
npx supabase db reset
```

This is destructive: it recreates the local database and applies all migrations in timestamp order. The migrations create the schema, constraints, triggers, views, indexes, reference data, development accounts, and demo/UAT records.

The current repository stores seed data in migration files, including:

- `20260919143000_seed_dev_admin.sql`
- `20260919150206_Seed_Reference_Data.sql`
- `20261010153450_demo_seed.sql`

For normal migration development:

```bash
make migrate-diff
```

Use `make migrate` or `npx supabase db reset` when you intentionally want a clean, destructive reset.

### 6. Start the application

```bash
make dev-build
```

For subsequent starts, when images do not need rebuilding:

```bash
make dev
```

Equivalent Docker command:

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

View logs with:

```bash
make logs
```

### 7. Verify the stack

Backend health:

```bash
curl http://localhost:8000/api/health
```

Expected response:

```json
{"status":"ok"}
```

Open these URLs in a browser:

- Frontend: <http://localhost:5173>
- Swagger API documentation: <http://localhost:8000/docs>
- Supabase Studio: <http://127.0.0.1:54323>

## Testing Accounts

### Demo/UAT accounts

The demo migration creates the following accounts. All demo passwords are `admin123`.

| Role | Username | Password | Branch |
|---|---|---|---|
| Admin | `demo-admin` | `admin123` | All branches |
| Branch Manager | `mgr-colombo` | `admin123` | Colombo |
| Branch Manager | `mgr-kandy` | `admin123` | Kandy |
| Branch Manager | `mgr-galle` | `admin123` | Galle |
| Receptionist | `rec-colombo` | `admin123` | Colombo |
| Receptionist | `rec-kandy` | `admin123` | Kandy |
| Receptionist | `rec-galle` | `admin123` | Galle |
| Doctor | `dr-anura` | `admin123` | Colombo |
| Doctor | `dr-priyanka` | `admin123` | Colombo |
| Doctor | `dr-kasun` | `admin123` | Colombo |
| Doctor | `dr-malini` | `admin123` | Kandy |
| Doctor | `dr-suresh` | `admin123` | Kandy |
| Doctor | `dr-thilini` | `admin123` | Galle |
| Doctor | `dr-nuwan` | `admin123` | Galle |

### QA account

The requested QA account is:

| Role | Username | Password |
|---|---|---|
| QA Tester | `dev-qa` | `admin123` |

Earlier development/test migrations also contain accounts such as `admin`, `bm`, `reception`, `doctor`, `qa`, `dev-admin`, `dev-manager`, and `dev-doctor`; these are separate from the demo/UAT account set.

### Login through the API

```bash
BASE=http://localhost:8000/api/v1

curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"demo-admin","password":"admin123"}' | jq
```

The login response contains an `access_token`. Use it as a Bearer token for protected endpoints:

```bash
TOKEN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"demo-admin","password":"admin123"}' | jq -r .access_token)

curl -s "$BASE/branches" \
  -H "Authorization: Bearer $TOKEN" | jq
```

## Complete System Workflow

### 1. Staff and branch setup

An Administrator creates staff records, assigns staff to branches, promotes eligible staff to Doctor subtype, links specialties, and creates user accounts. Branch Managers can manage staff within their permitted branch scope.

### 2. Patient registration

A Receptionist searches for an existing patient by name, NIC/passport number, or phone number before registering a new patient. Patient registration is attributed to the authenticated Receptionist's branch. Duplicate NIC/passport values are rejected so existing profiles can be reused.

Receptionists can add phone numbers, guardians, relationships, and insurance policies. Doctors and authorized staff can view relevant patient information across branches when required for treatment or emergency care.

### 3. Appointment booking

The Receptionist selects a patient, doctor, date, and time. The appointment branch is derived from the Receptionist and must match the selected doctor's branch. The patient's registered branch may be different, which supports cross-branch care.

The availability view shows occupied and available slots. Database rules reject overlapping appointments with a conflict response. Receptionists can also create walk-in appointments.

### 4. Consultation and treatment

The assigned Doctor views their appointments, completes the consultation, records consultation notes, and logs treatments against the completed appointment. Doctors can access and modify treatment information only for appointments assigned to them.

Treatment records are not deleted. Corrections are recorded as amendment rows so the original history remains auditable.

### 5. Billing and payment

Completing an appointment automatically creates a draft invoice. Logged treatments update the invoice subtotal. A Receptionist can apply insurance deductions or manual discounts, finalize the invoice, create insurance claims, and record full or partial payments.

Invoice balances are calculated from invoice and payment data rather than duplicated as mutable fields. Payments are append-only.

### 6. Reporting and audit

Administrators and Branch Managers can review appointment summaries, doctor revenue, treatment frequency, insurance versus out-of-pocket amounts, and outstanding balances. Audit records are written by database triggers and can be reviewed by Administrators and QA Testers.

### 7. QA and authorization checks

QA testing verifies authentication, branch restrictions, role permissions, cross-branch patient access, appointment overlap protection, invoice creation, treatment amendments, and audit attribution.

## API Overview

The API base path is `/api/v1`. Authentication uses Bearer JWT access tokens. Most successful responses use a `data` and `error` envelope; authentication endpoints return their payload directly.

The complete interactive API specification is available at:

- <http://localhost:8000/docs>
- <http://localhost:8000/openapi.json>

Common endpoint groups include:

- `/auth`
- `/branches`
- `/specialties`
- `/staff` and `/doctors`
- `/patients` and `/guardians`
- `/appointments`
- `/treatments`
- `/invoices`, `/payments`, and `/insurance-claims`
- `/reports`
- `/audit-logs`

List endpoints support pagination with `page` and `page_size` where implemented. Check Swagger for the exact request and response schema of each endpoint.

## Testing and Quality Checks

Run backend tests inside the backend container:

```bash
make test
```

Run backend Ruff checks and frontend Oxlint:

```bash
make lint
```

The backend test suite is in [backend/tests](backend/tests). The available end-to-end scripts are:

- [backend/scripts/integration_test.sh](backend/scripts/integration_test.sh): exercises staff creation, doctor promotion, account creation, patient registration, booking, overlap rejection, consultation completion, invoice creation, treatment logging, payment, and audit behavior.
- [backend/scripts/authorization_test.sh](backend/scripts/authorization_test.sh): checks role and branch authorization behavior, including cross-branch scenarios.

Run them from Git Bash, WSL, or Linux after the stack is running:

```bash
./backend/scripts/integration_test.sh
./backend/scripts/authorization_test.sh
```

The scripts require `curl` and `jq`. Their default credentials use the earlier stable test accounts (`admin`, `reception`, and `doctor`). Override credentials with environment variables when using another account set.

## Database Design Notes

The database is a central part of MedSync rather than only a persistence layer. The migration history contains:

- Core relational tables and enumerated roles/statuses.
- Foreign keys, uniqueness rules, and branch relationships.
- Appointment overlap and business-rule triggers.
- Automatic invoice creation and treatment subtotal updates.
- Audit triggers requiring transaction-local staff attribution.
- Views for invoice outstanding balances, patient profiles, appointment details, and doctor revenue.
- Indexes for search, branch filtering, appointments, and reporting.
- Refresh-token families and token-rotation support.
- Append-only payments and treatment amendments for historical integrity.

Direct SQL writes to audited tables may fail when `app.current_staff_id` is not set. Prefer using the API for normal application operations.

## Useful Commands

| Command | Description |
|---|---|
| `make setup` | Install root and backend dependencies |
| `make setup-frontend` | Install frontend dependencies |
| `make dev` | Start Supabase and application containers |
| `make dev-build` | Start Supabase and rebuild application containers |
| `make logs` | Follow application logs |
| `make down` | Stop application containers |
| `make down-all` | Stop application containers and Supabase |
| `make migrate` | Destructively reset and reapply migrations |
| `make migrate-diff` | Apply pending migrations without a full reset |
| `make migration name=<name>` | Create a new migration |
| `make db-cloud` | Push migrations to the linked cloud project |
| `make test` | Run backend tests |
| `make lint` | Run backend and frontend lint checks |

## Troubleshooting

### Port already in use

The default ports are `5173`, `8000`, `54321`, `54322`, and `54323`. Stop the conflicting service or adjust the relevant Docker, Vite, or Supabase configuration.

### Database connection refused

Confirm that Supabase is running:

```bash
npx supabase status
npx supabase start
```

Check the database hostname in `.env`. Use `host.docker.internal` for a containerized backend and `127.0.0.1` for a host-run backend.

### Backend dependencies are missing

```bash
cd backend
uv sync
```

### Frontend dependencies are missing or stale

PowerShell:

```powershell
Set-Location frontend
npm ci
```

Linux, macOS, Git Bash, or WSL:

```bash
cd frontend
npm ci
```

### Every protected endpoint returns 401

Log in again and use the new access token. Access tokens expire according to `ACCESS_TOKEN_EXPIRE_MINUTES`, which defaults to 15 minutes in the example configuration.

### Migration reset fails

Inspect the Supabase logs and confirm Docker Desktop is running. Remember that `npx supabase db reset` is destructive and must be run against the intended local project.

### Shell scripts do not run in PowerShell

The integration and authorization scripts use Bash syntax. Run them in Git Bash, WSL, or Linux, and ensure `curl` and `jq` are available.

## CI Note

The repository contains separate backend and frontend GitHub Actions workflows. The backend workflow triggers on changes under `backend/**`; the frontend workflow triggers on changes under `frontend/**`. Changes made only under `supabase/**` do not currently trigger either workflow, so database migration deployment requires an explicit process outside these path filters.

## Team Contributions

### Group No. 5

| Student ID | Name |
|---|---|
| 240188V | GAYAN N.M.D.T |
| 240224F | HERATH H.M.T.G.L.J |
| 240047N | ARUN S |
| 240673E | UMAYANGA P.H.A |
| 240288D | JAYATHILAKE P.I.K |

### API Domain Contributions

The following ownership records the main API domains implemented for the project:

| Contributor | API domains and project responsibilities |
|---|---|
| **GAYAN N.M.D.T** | Authentication, appointments, appointment treatments, reports, PDF reports, and treatment catalogue. Also contributed to database activities related to these domains. |
| **HERATH H.M.T.G.L.J** | Authentication, staff (doctor subtype, user account subtype), and reference-data(roles, specialties) domains. Also contributed to database activities, initial project setup, and CI/CD configuration and deployment. |
| **ARUN S** | Audit, branches, billing, patients, and guardians. Also contributed to the related database activities. |
| **JAYATHILAKE P.I.K** | Worked on database development and SQL queries, developed appointment management features, integrated related functionality, and fixed bugs. |
| **UMAYANGA P.H.A** | Worked on database design and SQL queries, developed patient and staff management interfaces, integrated backend APIs, and improved frontend functionality. |

Authentication is represented in more than one responsibility area: Gayan contributed to the authentication API and token behavior, while Lahiru contributed to staff accounts, role/access-control structures, and the initial setup supporting authentication.

### Database Migration Contributions

The migration filenames provide the database contribution trail. The API domain owner and the migration filename owner may differ because the application layer and database layer were developed as related but separately assigned work.

| Migration file | Database contribution |
|---|---|
| `20260916171524_kavinda.sql` | Foundational enums and core tables, including roles, specialties, treatment catalogue, branches, and staff. |
| `20260917054241_lahiru.sql` | Staff phone numbers, doctors, doctor specialties, user accounts, and the database validation that keeps Doctor roles consistent with Doctor records. |
| `20260918043554_asith.sql` | Patients, patient phone numbers, guardians, guardian phone numbers, patient-guardian relationships, and insurance policies. |
| `20260918113917_gayan.sql` | Appointments and appointment treatments, including appointment-overlap checks, completed-appointment requirements, and treatment deletion/amendment rules. |
| `20260918204343_arun.sql` | Invoices, payments, insurance claims, audit logs, automatic invoice creation, billing validation, claim validation, and audit triggers. |
| `20260919121341_table_views_gayan.sql` | Database views for outstanding invoices, patient profiles, appointment details, and doctor revenue. |
| `20260919132418_db_indexes_lahiru.sql` | Performance indexes for patient contact searches, treatment categories, appointment filtering, and treatment records. |
| `20260919140000_refresh_tokens.sql` | Hashed refresh-token sessions, token-family replacement tracking, revocation fields, foreign keys, and refresh-token indexes. |
| `20260919143000_seed_dev_admin.sql` | Development and test roles, branches, staff, doctors, and stable development accounts. |
| `20260919150206_Seed_Reference_Data.sql` | Shared reference data and stable integration-test accounts used by the backend test workflows. |
| `20261010150000_fix_amended_treatment_invoice.sql` | Amendment-aware invoice recalculation so draft totals include only effective, non-superseded treatments. |
| `20261010153450_demo_seed.sql` | Complete demo/UAT data covering staff, branches, patients, guardians, appointments, treatments, invoices, claims, payments, audit records, and refresh-token scenarios. |

### Frontend Contributions

The frontend was developed using React 19, TypeScript, Tailwind CSS, and Vite. Responsibilities and features delivered were divided as follows:

| Contributor | Frontend responsibilities and key features delivered |
|---|---|
| **JAYATHILAKE P.I.K.** | • Frontend architecture, routing, role-based navigation guards, and API client layer (JWT session management, refresh token rotation, snake_case/camelCase payload transformers).<br>• Appointment booking, live time-slot availability engine, and walk-in interactive schedule matrix with slot confirmation.<br>• Doctor consultation workflow, treatment entry, multiple treatment submissions, and amendment flows.<br>• Reports dashboard with analytics trend visualizations, financial charts, and PDF export integration.<br>• State management, toasts, error handling, and bug fixes across core modules. |
| **UMAYANGA P.H.A.** | • UI/UX design system, layout shell (`AppLayout`, `Sidebar`, `Topbar`), and responsive drawer navigation (`StaffDetailsDrawer`, `PatientDrawer`).<br>• Patient registration and patient management interfaces, including search, cross-branch filtering, and insurance policy integration.<br>• Staff management interfaces, staff creation forms, doctor promotion views, and account management/deletion controls.<br>• Role home landing pages (`ReceptionHomePage`, `DoctorHomePage`, `QAHomePage`) and report filter UI components.<br>• Reusable UI component styling, design consistency, and accessibility improvements. |
