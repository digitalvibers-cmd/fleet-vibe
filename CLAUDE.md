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

Most business logic lives in `packages/` submodules, not directly in `api/` or `console/`. When modifying extension behavior (fleet operations, storefront, IAM, etc.), the relevant submodule is where changes go. The main repo pins submodule commits — after updating a submodule, the pointer in the parent repo needs updating too.

## Docker Console Build — pnpm Symlink Caveat

`console/Dockerfile.dev` overlays local `packages/fleetops/` files on top of the npm-installed `@fleetbase/fleetops-engine`. Because pnpm uses a symlink store (`node_modules/@fleetbase/fleetops-engine` → `.pnpm/…/node_modules/@fleetbase/fleetops-engine`), files must be copied into the **resolved real path** (`readlink -f`), not the symlink path. A plain `COPY ... node_modules/@fleetbase/fleetops-engine/` creates a new directory alongside the symlink and the engine's actual package remains unchanged.

After changing files in `packages/fleetops/`, rebuild with `docker compose build --no-cache console` to ensure Docker doesn't serve cached layers.

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
