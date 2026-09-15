# CATMS

**Computerized Administration and Treatment Management System**

CATMS is a web-based system developed using:

- **Frontend:** React + Vite + TypeScript
- **Backend:** FastAPI + Python
- **Database:** PostgreSQL through Supabase
- **Database tooling:** Supabase CLI
- **Python dependency management:** uv
- **Containerization:** Docker + Docker Compose
- **Version control:** Git + GitHub

---

## 1. Development Plan

CATMS uses **Supabase Cloud as the final hosted database**, while developers use a **local Supabase environment during development**.

The development architecture is:

```text
Developer Machine
│
├── Frontend
│   └── React + Vite
│
├── Backend
│   └── FastAPI
│
└── Local Supabase
    ├── PostgreSQL
    ├── Authentication
    ├── Storage
    └── Other Supabase services
```

The local Supabase environment is managed by the **Supabase CLI** and runs through Docker.

The application services are managed separately through **Docker Compose**.

### Production

The final deployed architecture will be:

```text
                    Internet
                       │
              ┌────────┴────────┐
              │                 │
       Hosted Frontend     Hosted Backend
              │                 │
              └────────┬────────┘
                       │
                       ▼
                Supabase Cloud
                       │
                   PostgreSQL
```

Developers should **not use the production database for normal development**.

---

# 2. Why Local Supabase?

Each developer gets their own local database environment.

```text
Developer A
    │
    └── Local Supabase
        └── Local PostgreSQL

Developer B
    │
    └── Local Supabase
        └── Local PostgreSQL

Developer C
    │
    └── Local Supabase
        └── Local PostgreSQL
```

This prevents developers from interfering with each other's database data.

For example, if one developer is testing a destructive operation or changing a table, it does not affect another developer's local database.

Database changes are shared through **migration files committed to Git**.

---

# 3. Repository Structure

```text
catms/
│
├── backend/
│   ├── app/
│   │   ├── core/
│   │   ├── domains/
│   │   │   ├── reference/
│   │   │   ├── access/
│   │   │   ├── patients/
│   │   │   ├── appointments/
│   │   │   └── billing/
│   │   └── shared/
│   │
│   ├── tests/
│   ├── pyproject.toml
│   ├── uv.lock
│   └── Dockerfile.dev
│
├── frontend/
│   └── src/
│
├── supabase/
│   ├── migrations/
│   └── config.toml
│
├── docker-compose.dev.yml
├── Makefile
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
└── README.md
```

> The frontend is currently not initialized. `frontend/src/` is intentionally kept ready for the React/Vite application.

---

# 4. Prerequisites

Each team member needs the following installed:

- Git
- Docker
- Docker Compose
- Node.js 20+
- npm
- uv

Verify the installations:

```bash
git --version
docker --version
docker compose version
node --version
npm --version
uv --version
```

---

# 5. First-Time Setup

After cloning the repository:

```bash
git clone <repository-url>
cd catms
```

Then run:

```bash
make setup
```

The `setup` command performs the initial project setup:

```makefile
setup:
	cp -n .env.example .env || true
	npm install
	cd backend && uv sync
	npx supabase start
```

It will:

1. Create `.env` from `.env.example` if `.env` does not already exist.
2. Install root Node dependencies.
3. Install backend Python dependencies using `uv`.
4. Start the local Supabase environment.

### Important

If `.env` already exists, `make setup` will **not overwrite it**.

---

# 6. Environment Variables

The repository contains:

```text
.env.example
```

This file provides the required environment variable structure.

After running:

```bash
make setup
```

a local:

```text
.env
```

file will be created.

The `.env` file may contain local configuration and secrets, so it **must not be committed to Git**.

Use `.env.example` as the template for other developers.

---

# 7. Start the Application

After the initial setup, start the application with:

```bash
make dev
```

This runs:

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

Docker Compose is responsible for running the CATMS application services.

The local Supabase environment is already running from:

```bash
npx supabase start
```

which is executed by `make setup`.

The development environment therefore consists of:

```text
                 Developer Machine
                        │
          ┌─────────────┴─────────────┐
          │                           │
     Docker Compose              Supabase CLI
          │                           │
     ┌────┴─────┐              Local Supabase
     │          │                    │
  Backend   Frontend             PostgreSQL
  FastAPI   React/Vite           Auth/Storage/etc.
```

---

# 8. Makefile Commands

The project provides common commands through the Makefile.

## Setup

Run this when setting up the project for the first time:

```bash
make setup
```

This installs dependencies and starts local Supabase.

---

## Development

Start the application:

```bash
make dev
```

Docker Compose builds and starts the application containers.

---

## Stop Application

```bash
make down
```

This stops the Docker Compose services and stops the local Supabase environment.

---

## View Logs

```bash
make logs
```

This follows the Docker Compose logs:

```bash
docker compose -f docker-compose.dev.yml logs -f
```

---

## Reset Local Environment

```bash
make reset
```

This performs a **destructive reset**:

```bash
docker compose -f docker-compose.dev.yml down -v
npx supabase db reset
```

It removes Docker Compose volumes and resets the local Supabase database.

Use this when you need to completely reset your local development environment.

> **Warning:** Any local database data that is not represented by migrations may be lost.

---

# 9. Database Migrations

Database schema changes must be stored as Supabase migration files.

Migrations are located in:

```text
supabase/migrations/
```

For example:

```text
supabase/
└── migrations/
    ├── 001_initial_schema.sql
    ├── 002_users.sql
    ├── 003_patients.sql
    └── 004_appointments.sql
```

## Create a Migration

Use:

```bash
make migrate name=create_patients_table
```

This runs:

```bash
npx supabase migration new create_patients_table
```

A new migration file will be created inside:

```text
supabase/migrations/
```

Add the required SQL to the migration.

---

# 10. Database Development Workflow

When making a database change:

```text
1. Create migration
        │
        ▼
2. Write SQL
        │
        ▼
3. Test locally
        │
        ▼
4. Verify application
        │
        ▼
5. Commit migration
        │
        ▼
6. Pull Request
        │
        ▼
7. Merge
        │
        ▼
8. Deploy migration to Supabase Cloud
```

For example:

```bash
make migrate name=create_patients_table
```

Then test the migration locally.

Once it works:

```bash
git add supabase/migrations/
git commit -m "Add patients table"
git push
```

---

# 11. Local Database vs Production Database

There are two separate environments.

### Local Development

```text
Supabase CLI
     │
     ▼
Local Supabase
     │
     ▼
Local PostgreSQL
```

### Production

```text
Supabase Cloud
     │
     ▼
Hosted PostgreSQL
```

The local database is used for development and testing.

The Supabase Cloud database will be used by the deployed application.

---

# 12. Connecting to Supabase Cloud

When the project is ready for production database deployment, the repository can be linked to the Supabase Cloud project.

Login:

```bash
npx supabase login
```

Link the project:

```bash
npx supabase link --project-ref <PROJECT_ID>
```

Then migrations can be pushed to the hosted database:

```bash
npx supabase db push
```

Only authorized team members should perform production database changes.

---

# 13. Testing

Run the project's tests with:

```bash
make test
```

Currently this runs:

```bash
cd backend && uv run pytest
cd frontend && npm test
```

The frontend test command will become usable once the React/Vite frontend has been initialized and the corresponding test script has been added to `frontend/package.json`.

---

# 14. Linting

Run:

```bash
make lint
```

This currently runs:

```bash
cd backend && uv run ruff check .
cd frontend && npm run lint
```

The frontend lint command will become usable once the frontend is initialized and the `lint` script is added to `frontend/package.json`.

---

# 15. Team Git Workflow

The `main` branch should contain stable code.

Before starting new work:

```bash
git checkout main
git pull
```

Create a feature branch:

```bash
git checkout -b feature/<feature-name>
```

For example:

```bash
git checkout -b feature/patient-management
```

After completing the work:

```bash
git add .
git commit -m "Add patient management"
git push -u origin feature/patient-management
```

Create a Pull Request on GitHub.

After review, merge the Pull Request into `main`.

---

# 16. What Should and Should Not Be Committed

### Commit

```text
backend/
frontend/
supabase/
docker-compose.dev.yml
Makefile
README.md
package.json
package-lock.json
backend/pyproject.toml
backend/uv.lock
.env.example
```

### Do NOT commit

```text
.env
.venv/
node_modules/
__pycache__/
*.pyc
```

The `.gitignore` file should ensure these files are excluded.

---

# 17. Typical New Team Member Workflow

A new team member should only need to do:

```bash
git clone <repository-url>
cd catms
make setup
make dev
```

After setup is complete, their normal workflow is:

```bash
git pull
make dev
```

Then they can work on their assigned feature.

---

# 18. Overall CATMS Development Workflow

```text
                     GitHub
                       │
                       │ clone / pull
                       ▼
              Developer Machine
                       │
          ┌────────────┼────────────┐
          │            │            │
      Frontend      Backend     Local Supabase
      React/Vite    FastAPI      PostgreSQL
          │            │            │
          └────────────┼────────────┘
                       │
                    Develop
                       │
                     Test
                       │
                 Create PR
                       │
                       ▼
                    main
                       │
          ┌────────────┴────────────┐
          │                         │
   Application Deployment     Database Migration
          │                         │
          ▼                         ▼
   Hosted Application         Supabase Cloud
```

---

# 19. Development Principle

The repository should contain everything required to reproduce the development environment.

```text
Application Code
       +
Database Migrations
       +
Configuration
       +
Dependency Lockfiles
       │
       ▼
     GitHub
```

The intended workflow is:

> **Develop locally → test locally → commit code and migrations → review → deploy.**

Developers should avoid making undocumented database changes directly in the production Supabase database.

The **local Supabase environment is for development**, while **Supabase Cloud is the final hosted database**.