.PHONY: setup setup-frontend dev down down-all reset logs migration migrate migrate-diff db-cloud test lint

COMPOSE := docker compose -f docker-compose.dev.yml

setup:
	cp -n .env.example .env || true
	npm install
	cd backend && uv sync

setup-frontend:
	cd frontend && npm ci

dev:
	npx supabase start
	$(COMPOSE) up -d

dev-build:
	npx supabase start
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

# Stop app containers AND Supabase
down-all:
	$(COMPOSE) down
	npx supabase stop

reset:
	$(COMPOSE) down -v
	npx supabase db reset

logs:
	$(COMPOSE) logs -f

migration:                    ## Create a new empty migration file: make migration name=add_patient_index
	npx supabase migration new $(name)

migrate:                      ## Apply all pending migrations (destructive, drops DB)
	npx supabase db reset

migrate-diff:                 ## Apply pending without full reset
	npx supabase migration up

# Push local migrations to the linked cloud Supabase project.
db-cloud:
	npx supabase db push

test:
	$(COMPOSE) exec -T backend uv run pytest

lint:
	cd backend && uv run ruff check .
	cd frontend && npm run lint
