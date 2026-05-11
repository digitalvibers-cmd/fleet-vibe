# Fleet Vibe / LogiVibe - environment helpers.
#
# All targets are env-aware: choose the overlay you want via the target name.
#   make local       # start local stack (localhost domains, mail to log)
#   make dev         # start dev stack (only on the dev server)
#   make prod        # start prod stack (only on the prod server)

LOCAL_FILES = -f docker-compose.yml -f docker-compose.local.yml
DEV_FILES   = -f docker-compose.yml -f docker-compose.dev.yml
PROD_FILES  = -f docker-compose.yml -f docker-compose.prod.yml

.PHONY: help local local-down local-logs local-build local-shell \
        dev dev-down dev-logs dev-build \
        prod prod-down prod-logs prod-build \
        migrate seed test status

help:
	@echo "Local development:"
	@echo "  make local         Start local stack (localhost, mail to log)"
	@echo "  make local-down    Stop local stack"
	@echo "  make local-logs    Tail logs"
	@echo "  make local-build   Rebuild all images (no cache)"
	@echo "  make local-shell   Bash in the application container"
	@echo ""
	@echo "Dev server (run on the dev server only):"
	@echo "  make dev / dev-down / dev-logs / dev-build"
	@echo ""
	@echo "Prod server (run on the prod server only):"
	@echo "  make prod / prod-down / prod-logs / prod-build"
	@echo ""
	@echo "Common:"
	@echo "  make migrate       php artisan migrate (against running stack)"
	@echo "  make seed          php artisan db:seed"
	@echo "  make status        docker compose ps"
	@echo "  make test          run console + API test suites"

# Local
local:
	docker compose $(LOCAL_FILES) up -d
local-down:
	docker compose $(LOCAL_FILES) down
local-logs:
	docker compose $(LOCAL_FILES) logs -f --tail=200
local-build:
	docker compose $(LOCAL_FILES) build --no-cache
local-shell:
	docker compose $(LOCAL_FILES) exec application bash

# Dev (run on dev server)
dev:
	docker compose $(DEV_FILES) up -d
dev-down:
	docker compose $(DEV_FILES) down
dev-logs:
	docker compose $(DEV_FILES) logs -f --tail=200
dev-build:
	docker compose $(DEV_FILES) build --no-cache

# Prod (run on prod server)
prod:
	docker compose $(PROD_FILES) up -d
prod-down:
	docker compose $(PROD_FILES) down
prod-logs:
	docker compose $(PROD_FILES) logs -f --tail=200
prod-build:
	docker compose $(PROD_FILES) build --no-cache

# Operates against the running stack regardless of overlay.
migrate:
	docker compose exec application php artisan migrate
seed:
	docker compose exec application php artisan db:seed
status:
	docker compose ps
test:
	cd console && pnpm test
	cd api && php artisan test
