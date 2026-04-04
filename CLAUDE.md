# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fleetbase is a modular logistics and supply chain operating system (v0.7.28). It uses a PHP/Laravel backend API, an Ember.js frontend console, and 14 git submodules in `packages/` for shared libraries and extensions.

**License**: Dual-licensed under AGPL-3.0 (open source) and FCL (commercial).

## Architecture

- **api/**: Laravel 10 backend running on Laravel Octane with FrankenPHP. Uses Composer for dependencies.
- **console/**: Ember.js 5.4 frontend with Tailwind CSS. Uses pnpm as package manager.
- **packages/**: Git submodules containing core libraries and extension engines:
  - `core-api` / `ember-core` / `ember-ui` — shared foundation libraries
  - `fleetops` — main fleet operations engine (the primary extension)
  - `storefront`, `pallet`, `ledger`, `iam-engine`, `dev-engine` — feature extensions
  - `registry-bridge`, `fleetbase-extensions-indexer` — extension system infrastructure
  - `fleetops-data` — FleetOps data models
- **docker/**: Dockerfiles and service configs (httpd, database init scripts)
- **scripts/**: Installation and deployment scripts

### Services (docker-compose.yml)

| Service | Description | Port |
|---------|-------------|------|
| application | Laravel API (FrankenPHP + Octane) | — |
| httpd | Reverse proxy (Apache/Caddy) | 8000 |
| console | Ember.js frontend (nginx) | 4200 |
| database | MySQL 8.0 | 33060 |
| cache | Redis 4 | — |
| queue | Laravel queue worker (Redis) | — |
| scheduler | Cron jobs via go-crond | — |
| socket | SocketCluster v17 (WebSocket) | 38000 |

### Frontend-API Connection

Console connects to the API via config in `console/fleetbase.config.json`:
- API_HOST: `http://localhost:8000`
- SocketCluster: `localhost:38000`

## Common Commands

### Docker (primary development method)

```bash
./scripts/docker-install.sh          # Interactive first-time setup
docker compose up -d                  # Start all services
docker compose down                   # Stop all services
docker compose exec application bash  # Shell into API container
docker compose exec application php artisan migrate  # Run migrations
docker compose exec application php artisan tinker   # Laravel REPL
```

The install script generates `docker-compose.override.yml` with environment-specific settings (APP_KEY, host, HTTPS config).

### Console (Ember.js)

```bash
cd console
pnpm install
pnpm start              # ember serve (dev on port 4200)
pnpm run build          # ember build
pnpm run lint           # all linters (eslint, stylelint, ember-template-lint, intl)
pnpm run lint:js        # eslint only
pnpm run lint:css       # stylelint only
pnpm run lint:hbs       # handlebars template lint only
pnpm run test           # lint + test suite
pnpm run test:ember     # qunit tests only via ember test
```

### API (Laravel)

```bash
cd api
composer install
php artisan key:generate
php artisan migrate
php artisan queue:work       # Process queue jobs
php artisan test             # PHPUnit tests (phpunit.xml)
```

### Deployment

```bash
# Inside the application container:
./deploy.sh   # Runs migrations, seeders, cache clearing
```

## Code Style

### Console
- Prettier: tabWidth 4, printWidth 190, trailingComma "es5"
- ESLint configured via `.eslintrc.js`
- Stylelint configured via `.stylelintrc.js`
- Handlebars templates linted via `.template-lintrc.js`

### API
- Standard Laravel conventions
- PHP 8.0-8.2 compatibility

## Submodule Workflow

Most business logic lives in `packages/` submodules, not directly in `api/` or `console/`. When modifying extension behavior (storefront, IAM, etc.), the relevant submodule is where changes go. The main repo pins submodule commits — after updating a submodule, the pointer in the parent repo needs updating too.

**Exception — `packages/fleetops/` is embedded, not a submodule.** It is tracked as regular files in the parent repo so the local Docker overlay (see below) can customize it. This means upstream Fleetbase syncs for fleetops are done by manually copying files into `packages/fleetops/`, which **will overwrite any local edits in that directory**. Do NOT put LogiVibe-specific overrides inside `packages/fleetops/`. Put them in `console/app/styles/` (CSS), in a custom extension, or in `console/app/` directly.

## Where to Put Local Overrides (so upstream syncs don't break them)

- **CSS overrides for Fleetbase components**: `console/app/styles/console.css`. It is part of the main Ember bundle, loads globally, and lives outside `packages/`. Example: the mobile responsiveness fix for `.next-content-overlay-panel` lives here.
- **New UI behavior**: a custom Ember extension (see "Custom Extensions" below), not a patch to `packages/ember-ui/` or `packages/fleetops/`.
- **API overrides**: a custom Laravel package, not a patch to `packages/core-api/`.

## Docker Console Build — pnpm Symlink Caveat

`console/Dockerfile.dev` overlays local `packages/fleetops/` files on top of the npm-installed `@fleetbase/fleetops-engine`. Because pnpm uses a symlink store (`node_modules/@fleetbase/fleetops-engine` → `.pnpm/…/node_modules/@fleetbase/fleetops-engine`), files must be copied into the **resolved real path** (`readlink -f`), not the symlink path. A plain `COPY ... node_modules/@fleetbase/fleetops-engine/` creates a new directory alongside the symlink and the engine's actual package remains unchanged.

After changing files in `packages/fleetops/` **or** `console/app/`, rebuild with `docker compose build --no-cache console` to ensure Docker doesn't serve cached layers.

## Ember Engine Gotchas (fleetops-engine)

- **Lazy-loaded engine**: `fleetops-engine` uses `lazyLoading: { enabled: true }`. Its components are NOT in the main `console.js` bundle — they are in `engines-dist/@fleetbase/fleetops-engine/assets/engine.js`. When verifying build output, check that file, not `@fleetbase/console.js`.
- **Place model computed properties**: The `Place` model (from `@fleetbase/fleetops-data`) has `latitude` and `longitude` as **computed properties** derived from the `location` GeoJSON field (`get latitude() { return get(this.location, 'coordinates.1') }`). Never pass `latitude`/`longitude` directly to `store.createRecord('place', ...)` — it will throw "Cannot override computed property". Only pass the `location` object `{ type: 'Point', coordinates: [lng, lat] }`.
- **Ember Data relationships**: When setting a value on a `belongsTo` relationship (e.g. `payload.pickup`), you must use a proper Ember Data model instance (`store.createRecord(...)`) — plain `EmberObject.create()` will be rejected.

## Key Environment Variables

Set via `docker-compose.override.yml` or container environment:
- `DATABASE_URL` — MySQL connection string
- `QUEUE_CONNECTION` — `redis`
- `CACHE_DRIVER` / `CACHE_URL` / `REDIS_URL` — Redis caching
- `BROADCAST_DRIVER` — `socketcluster` for real-time features
- `REGISTRY_HOST` — Fleetbase extension registry
- `OSRM_HOST` — Routing engine for fleet operations

## LogiVibe — Project Context

This repository is **LogiVibe**, an internal logistics operations system for **FlyBox Delivery**, built on top of the Fleetbase open-source platform. It is NOT a multi-tenant SaaS — it is a single-tenant internal tool for managing orders, dispatching, drivers, and real-time tracking within one company.

Key project documents:
- `Strategy` — Strategic plan and product vision
- `ROADMAP.md` — Task tracker with progress checkboxes across 3 phases

## Branching & Deployment Strategy

| Branch | Environment | Domain | Notes |
|--------|------------|--------|-------|
| `dev` | **Development** | `fleetvibe.digitalvibe.rs` | Active development, auto-deploy on push |
| `main` | **Production** | `fleetvibe.flyboxdelivery.rs` | Stable releases only, auto-deploy on push, protected with basic auth |

**Rules:**
- All development work happens on `dev` or feature branches merged into `dev`.
- `main` only receives merges from `dev` when a release is ready.
- CI/CD (GitHub Actions) deploys automatically:
  - Push to `dev` → deploy to dev server
  - Push to `main` → deploy to production server
- Production domain has **basic auth** protection in front of Nginx.

## Environments

### Development
- **Console**: `https://fleetvibe.digitalvibe.rs`
- **API**: `https://apifleetvibe.digitalvibe.rs`
- No basic auth, open for testing

### Production (configured at go-live)
- **Console**: `https://fleetvibe.flyboxdelivery.rs` (basic auth required)
- **API**: `https://apifleetvibe.flyboxdelivery.rs`

## Infrastructure

- **Hosting**: Hetzner Cloud, Falkenstein datacenter (Germany, EU)
- **Server**: CPX31 — 4 vCPU (shared AMD), 8 GB RAM, 160 GB NVMe SSD
- **OS**: Ubuntu 22.04 LTS
- **Reverse Proxy**: Nginx with Let's Encrypt SSL
- **Backups**: Hetzner Automated Backups + MySQL dump cron (every 6h)
- **Monitoring**: Sentry (error tracking) + UptimeRobot (uptime) + Hetzner alerts

## Customer Portal

A separate custom frontend application (`customer-portal/`) where FlyBox Delivery's clients can:
- Log in with their own credentials
- Create new delivery requests
- View list of their previous orders (ONLY their own — data isolation by customer_id)
- Track delivery status

The portal communicates with the Fleetbase API layer. Data isolation is critical — a client must never see another client's orders.

## Custom Extensions

LogiVibe builds proprietary Fleetbase extensions to add functionality without modifying core:
- **logivibe-analytics** — Ember Engine for KPI dashboards, operational reports, driver scoring
- Extensions follow the Fleetbase pattern: Ember Engine (frontend) + Laravel package (backend)
- Use `fleetbase extension:make` CLI to scaffold new extensions
- Keep core Fleetbase modifications to an absolute minimum to allow upstream updates

## Development Guidelines

1. **Minimize core changes**: Prefer extensions over modifying `packages/` submodules. If a core change is unavoidable, document it clearly.
2. **Configuration via UI**: User roles, permissions, order statuses, places, and vehicles are managed through the Fleetbase console UI — do not create seeders for these.
3. **User creation**: Done at the end of each phase, manually through UI.
4. **Test on dev first**: Always deploy and verify on `fleetvibe.digitalvibe.rs` before merging to `main`.
5. **Docker parity**: Local dev and server both use Docker Compose. Production uses `docker-compose.prod.yml` as override.
