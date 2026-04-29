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
- `MAIL_MAILER` — Mail driver (`mailgun` on dev/prod)
- `MAILGUN_DOMAIN` / `MAILGUN_SECRET` / `MAILGUN_ENDPOINT` — Mailgun credentials (EU endpoint: `api.eu.mailgun.net`)
- `MAIL_FROM_ADDRESS` / `MAIL_FROM_NAME` — Sender identity for outgoing emails

### Mail Configuration

Mail is configured via **environment variables** in `docker-compose.override.yml`, NOT through the Fleetbase Admin UI. The Fleetbase Admin panel "Notification Channels" setting does NOT affect Laravel's `$user->notify()` calls (used for user invitations, etc.). All three services that send or process email (`application`, `queue`, `scheduler`) must have the same `MAIL_*` / `MAILGUN_*` env vars. A YAML anchor `x-mail-env` is used to keep them in sync.

## LogiVibe — Project Context

This repository is **LogiVibe**, an internal logistics operations system for **FlyBox Delivery**, built on top of the Fleetbase open-source platform. It is NOT a multi-tenant SaaS — it is a single-tenant internal tool for managing orders, dispatching, drivers, and real-time tracking within one company.

Key project documents:
- `Strategy` — Strategic plan and product vision
- `ROADMAP.md` — Task tracker with progress checkboxes across 3 phases

## Branching & Deployment Strategy

| Branch | Environment | Domain | Notes |
|--------|------------|--------|-------|
| `dev` | **Development** | `fleetvibe.digitalvibe.rs` | Active development, auto-deploy on push |
| `main` | **Production** | `flybox.rs` / `console.flybox.rs` | Stable releases only, auto-deploy on push |

**Rules:**
- All development work happens on `dev` or feature branches merged into `dev`.
- `main` only receives merges from `dev` when a release is ready.
- CI/CD (GitHub Actions) deploys automatically:
  - Push to `dev` → deploy to dev server
  - Push to `main` → deploy to production server

## Environments

### Development
- **Console**: `https://fleetvibe.digitalvibe.rs`
- **API**: `https://apifleetvibe.digitalvibe.rs`
- **Portal**: `https://portal-fleetvibe.digitalvibe.rs`
- No basic auth, open for testing

### Production
- **Portal** (customer-facing): `https://flybox.rs`
- **Console** (internal ops): `https://console.flybox.rs`
- **API**: `https://api.flybox.rs`

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

### Customer Portal PWA

The portal is installable as a PWA:
- **Manifest**: `customer-portal/public/manifest.json` — FlyBox branding, `start_url: /dashboard`, `display: standalone`
- **Service worker**: `customer-portal/public/sw.js` — cache-first for `_next/static/*`, network-only for HTML/API (no offline mode)
- **Install CTA**: `components/PwaInstallBanner.tsx`, rendered inside `Header.tsx` so it appears ONLY on authenticated pages (never on `/login`). Respects `display-mode: standalone` and `localStorage["pwa-install-dismissed"]`.
- **Event capture**: `lib/pwa.ts` module-level store + `components/PwaProvider.tsx` (mounted in root layout) captures `beforeinstallprompt` before React hydrates.
- **Middleware**: `sw.js`, `manifest.json`, and `icons/` are excluded from the auth middleware matcher in `middleware.ts`.

iOS Safari does not fire `beforeinstallprompt`, so the CTA never appears there — iOS users install via the Safari "Add to Home Screen" menu.

## Custom Extensions

LogiVibe builds proprietary Fleetbase extensions to add functionality without modifying core:
- **logivibe-analytics** — Ember Engine for KPI dashboards, operational reports, driver scoring
- Extensions follow the Fleetbase pattern: Ember Engine (frontend) + Laravel package (backend)
- Use `fleetbase extension:make` CLI to scaffold new extensions
- Keep core Fleetbase modifications to an absolute minimum to allow upstream updates

## Deployment Gotchas

### PHP changes require manual container restart
The CI/CD deploy script (`fleetvibe-deploy-dev`) only rebuilds and restarts the `console` container. Changes to `packages/fleetops/server/` or any other PHP code are NOT picked up automatically — Laravel Octane keeps classes in memory. After pushing PHP changes, always SSH to the server and run:
```bash
docker compose restart application queue
```

### Customer Portal deploy
The portal (`customer-portal/`) is deployed by a separate script (`/usr/local/bin/fleetvibe-deploy-portal`). It rebuilds the `customer-portal` Docker container from source. Build-time env vars (e.g. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) are written by CI into `/home/deploy/.portal-env` — this file must be owned by the `deploy` user, not root. If the portal CI action fails with "Permission denied" on `.portal-env`, run `chown deploy:deploy /home/deploy/.portal-env` on the server.

### Internal API route prefix
Fleetbase internal routes use the `/int/v1/` prefix. The `fleetbaseRoutes('orders', ...)` macro inside the `v1` group registers at `/int/v1/orders/`, **not** `/int/v1/fleet-ops/orders/`. The customer portal's `fleetbaseApi("orders", ...)` correctly maps to `/int/v1/orders`. Do not add `fleet-ops/` prefix when calling internal order routes from the portal.

### NotificationRegistry and portal (customer) auth tokens
`NotificationRegistry::notify()` calls `Setting::lookupCompany('notification_settings')` which reads `session('company')`. Portal requests authenticate with customer contact tokens — these do **not** populate `session('company')`, so the registry finds no notifiables and silently sends nothing. When calling `NotificationRegistry::notify()` in a context that may be triggered by a portal request (observer, controller endpoint), inject the company from the model first:
```php
if ($order->company_uuid && session()->missing('company')) {
    session(['company' => $order->company_uuid]);
}
```

### Dev and prod stacks on the same server

Both dev (`/opt/fleetvibe`) and prod (`/opt/fleetvibe-prod`) run on the same Hetzner server (46.225.99.48) using different port offsets. Host port bindings live in the env-specific overlay files, NOT in `docker-compose.yml` (base has no port bindings to avoid merge conflicts):

| Service | Dev port | Prod port |
|---------|----------|-----------|
| console | 4200 | 4201 |
| httpd (API) | 8000 | 8001 |
| socket | 38000 | 38001 |
| database | 33060 | 33061 |
| customer-portal | 3000 | 3001 |

Prod stack is managed with: `docker compose -f docker-compose.yml -f docker-compose.prod.yml <command>`

### MySQL databases for prod

On first setup, MySQL only creates `fleetbase`. The Storefront and Sandbox extensions need additional databases. Create them once manually:
```bash
docker exec fleetvibe-prod-database-1 mysql -uroot -p<PROD_DB_PASSWORD> -e '
CREATE DATABASE IF NOT EXISTS fleetbase_storefront;
CREATE DATABASE IF NOT EXISTS fleetbase_sandbox;
'
```

### Bulk notification pattern (X-Skip-Order-Notification)
To suppress individual `OrderCreated` emails during bulk import and send one summary instead:
- Portal sends `headers: { 'X-Skip-Order-Notification': '1' }` on each order POST
- `OrderController::createRecord()` sets `app()->instance('fleetops.skip_order_notification', true)` before `createRecordFromRequest()`, clears it in `finally`
- `OrderObserver::created()` checks `app()->bound('fleetops.skip_order_notification')` and returns early
- After the loop, portal calls `POST /int/v1/orders/notify-bulk-created` with `{ order_ids: [...public_ids], count: N }` — use `o.public_id`, not `o.id` (the API response field `id` may be undefined)
- `OrderController::notifyBulkCreated()` resolves notifiables from `OrderCreated` settings (already configured in UI) and sends `OrdersBulkCreated` to them

## Development Guidelines

1. **Minimize core changes**: Prefer extensions over modifying `packages/` submodules. If a core change is unavoidable, document it clearly.
2. **Configuration via UI**: User roles, permissions, order statuses, places, and vehicles are managed through the Fleetbase console UI — do not create seeders for these.
3. **User creation**: Done at the end of each phase, manually through UI.
4. **Test on dev first**: Always deploy and verify on `fleetvibe.digitalvibe.rs` before merging to `main`.
5. **Docker parity**: Local dev and server both use Docker Compose. Production uses `docker-compose.prod.yml` as override.
