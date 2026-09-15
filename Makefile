.PHONY: setup setup-frontend dev down down-all reset logs migration migrate migrate-diff db-cloud test lint

setup:
	cp -n .env.example .env || true
	npm install
	cd backend && uv sync

setup-frontend:
	cd frontend && npm ci

dev:
	npx supabase start
	docker compose -f docker-compose.dev.yml up -d --build

down:
	docker compose -f docker-compose.dev.yml down

# Stop app containers AND Supabase
down-all:
	docker compose -f docker-compose.dev.yml down
	npx supabase stop

reset:
	docker compose -f docker-compose.dev.yml down -v
	npx supabase db reset

logs:
	docker compose -f docker-compose.dev.yml logs -f

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
	cd backend && uv run pytest
	cd frontend && npm test

lint:
	cd backend && uv run ruff check .
	cd frontend && npm run lint

